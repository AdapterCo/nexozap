import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  ConnectionState,
} from '@whiskeysockets/baileys';
import * as path from 'path';
import * as fs from 'fs';
import * as QRCode from 'qrcode';

@Injectable()
export class WhatsAppService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly sessionsDir: string;
  private connections: Map<string, WASocket> = new Map();
  private qrCodes: Map<string, string> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {
    this.sessionsDir = path.resolve(this.configService.get<string>('SESSIONS_DIR', path.join(process.cwd(), 'whatsapp-sessions')));
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async onModuleDestroy() {
    for (const [companyId, sock] of this.connections) {
      try {
        sock.end(undefined);
        this.logger.log(`Disconnected session for company ${companyId}`);
      } catch (error) {
        this.logger.warn(`Error disconnecting session ${companyId}: ${error.message}`);
      }
    }
    this.connections.clear();
  }

  async connect(companyId: string) {
    const existing = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (this.connections.has(companyId)) {
      const sock = this.connections.get(companyId);
      if (sock?.user) {
        return {
          status: 'CONNECTED',
          message: 'Sessão já está ativa e conectada',
          phone: existing?.phone || null,
        };
      }

      // Sessão existe em memória mas não está autenticada, verifica QR
      const qr = this.qrCodes.get(companyId);
      if (qr) {
        const qrData = await this.formatQRCode(qr);
        return {
          status: 'RECONNECTING',
          message: 'Escaneie o QR Code para conectar',
          ...qrData,
        };
      }

      return {
        status: existing?.status || 'RECONNECTING',
        message: 'Aguardando geração do QR Code...',
      };
    }

    const sessionDir = path.join(this.sessionsDir, companyId);

    let state: any;
    let saveCreds: () => Promise<void>;

    try {
      const authResult = await useMultiFileAuthState(sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    } catch (error) {
      this.logger.error(`Erro ao carregar estado de autenticação para ${companyId}: ${error.message}`);
      // Limpar sessão corrompida e tentar novamente
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      const authResult = await useMultiFileAuthState(sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    }

    let sock: WASocket;
    try {
      sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['NexoZap', 'Chrome', '4.0.0'],
        generateHighQualityLinkPreview: false,
      });
    } catch (error) {
      this.logger.error(`Erro ao criar socket WhatsApp para ${companyId}: ${error.message}`);
      throw new Error(`Falha ao iniciar conexão WhatsApp: ${error.message}`);
    }

    this.connections.set(companyId, sock);

    sock.ev.on('creds.update', saveCreds);

    // Criar/atualizar registro no banco ANTES de esperar o QR
    const existingConn = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });
    if (existingConn) {
      await this.prisma.whatsAppConnection.update({
        where: { id: existingConn.id },
        data: { status: 'RECONNECTING', instanceName: companyId, qrcode: null },
      });
    } else {
      await this.prisma.whatsAppConnection.create({
        data: {
          companyId,
          instanceName: companyId,
          status: 'RECONNECTING',
        },
      });
    }

    // Configurar event listeners
    this.setupConnectionEvents(companyId, sock);
    this.setupMessageHandler(companyId, sock);

    // Esperar até 15 segundos pelo primeiro QR Code
    const qrCode = await this.waitForQRCode(companyId, 15000);

    if (qrCode) {
      const qrData = await this.formatQRCode(qrCode);
      return {
        status: 'RECONNECTING',
        message: 'Escaneie o QR Code para conectar',
        ...qrData,
      };
    }

    // Verificar se conectou diretamente (sessão salva)
    if (sock.user) {
      return {
        status: 'CONNECTED',
        message: 'Conectado com sessão existente',
        phone: sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || '',
      };
    }

    return { status: 'RECONNECTING', message: 'Conectando... aguarde o QR Code' };
  }

  private waitForQRCode(companyId: string, timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      // Verificar se já existe um QR
      const existing = this.qrCodes.get(companyId);
      if (existing) {
        resolve(existing);
        return;
      }

      const checkInterval = setInterval(() => {
        const qr = this.qrCodes.get(companyId);
        if (qr) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(qr);
        }
      }, 500);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        this.logger.warn(`Timeout aguardando QR Code para ${companyId} (${timeoutMs}ms)`);
        resolve(null);
      }, timeoutMs);

      // Se a conexão abrir antes do timeout (sessão salva), resolver
      const sock = this.connections.get(companyId);
      if (sock) {
        const originalHandler = sock.ev.listeners?.('connection.update');
        const checkConnection = () => {
          if (sock.user) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve(null);
          }
        };
        const connInterval = setInterval(checkConnection, 500);
        setTimeout(() => clearInterval(connInterval), timeoutMs);
      }
    });
  }

  private setupConnectionEvents(companyId: string, sock: WASocket) {
    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      this.logger.log(`Connection update for ${companyId}: connection=${connection}, hasQR=${!!qr}`);

      if (qr) {
        this.qrCodes.set(companyId, qr);
        try {
          const existingConn = await this.prisma.whatsAppConnection.findFirst({
            where: { companyId },
          });
          if (existingConn) {
            await this.prisma.whatsAppConnection.update({
              where: { id: existingConn.id },
              data: { status: 'RECONNECTING', qrcode: qr },
            });
          }
          this.logger.log(`QR Code gerado e salvo para empresa ${companyId}`);
        } catch (error) {
          this.logger.error(`Erro ao salvar QR Code no banco para ${companyId}: ${error.message}`);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        const restartRequired = statusCode === DisconnectReason.restartRequired;

        this.logger.log(`Conexão fechada para ${companyId}, status: ${statusCode}, reconectar: ${shouldReconnect}`);

        try {
          await this.prisma.whatsAppConnection.updateMany({
            where: { companyId },
            data: { status: restartRequired || shouldReconnect ? 'RECONNECTING' : 'DISCONNECTED', qrcode: null },
          });
        } catch (error) {
          this.logger.error(`Erro ao atualizar status de desconexão para ${companyId}: ${error.message}`);
        }

        this.connections.delete(companyId);
        this.qrCodes.delete(companyId);

        if (shouldReconnect) {
          const delay = restartRequired ? 1000 : 5000;
          this.logger.log(`Reconectando ${companyId} em ${delay}ms...`);
          setTimeout(() => this.connect(companyId), delay);
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || '';

        try {
          const existingConn = await this.prisma.whatsAppConnection.findFirst({
            where: { companyId },
          });
          if (existingConn) {
            await this.prisma.whatsAppConnection.update({
              where: { id: existingConn.id },
              data: { status: 'CONNECTED', qrcode: null, phone },
            });
          } else {
            await this.prisma.whatsAppConnection.create({
              data: {
                companyId,
                instanceName: companyId,
                status: 'CONNECTED',
                phone,
              },
            });
          }
        } catch (error) {
          this.logger.error(`Erro ao atualizar status de conexão para ${companyId}: ${error.message}`);
        }

        this.qrCodes.delete(companyId);
        this.logger.log(`Conectado para empresa ${companyId}, telefone: ${phone}`);
      }
    });
  }

  private setupMessageHandler(companyId: string, sock: WASocket) {
    sock.ev.on('messages.upsert', async (messageUpdate) => {
      if (messageUpdate.type !== 'notify') return;

      for (const msg of messageUpdate.messages) {
        try {
          await this.handleIncomingMessage(companyId, msg);
        } catch (error) {
          this.logger.error(`Erro ao processar mensagem recebida para ${companyId}: ${error.message}`);
        }
      }
    });
  }

  async getQRCode(companyId: string) {
    const qr = this.qrCodes.get(companyId);
    if (qr) {
      return this.formatQRCode(qr);
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (connection?.qrcode) {
      return this.formatQRCode(connection.qrcode);
    }

    return { qrcode: null, message: 'QR Code ainda não disponível' };
  }

  private async formatQRCode(qr: string) {
    try {
      const qrCode = await QRCode.toDataURL(qr, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
      });

      return { qrcode: qr, qrCode };
    } catch (error) {
      this.logger.error(`Erro ao gerar imagem do QR Code: ${error.message}`);
      return { qrcode: qr, qrCode: null, message: 'Erro ao renderizar QR Code' };
    }
  }

  async getStatus(companyId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) {
      return { status: 'DISCONNECTED', phone: null };
    }

    if (connection.status === 'RECONNECTING' && connection.qrcode) {
      try {
        const qr = await this.formatQRCode(connection.qrcode);
        return { status: 'RECONNECTING', phone: connection.phone, ...qr };
      } catch (error) {
        this.logger.error(`Erro ao formatar QR Code no status para ${companyId}: ${error.message}`);
        return { status: 'RECONNECTING', phone: connection.phone };
      }
    }

    const sock = this.connections.get(companyId);
    const isConnected = sock?.user != null;

    if (isConnected && connection.status !== 'CONNECTED') {
      await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: 'CONNECTED', qrcode: null },
      });
      return { status: 'CONNECTED', phone: connection.phone };
    }

    if (!isConnected && connection.status === 'CONNECTED') {
      await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: 'DISCONNECTED' },
      });
      return { status: 'DISCONNECTED', phone: null };
    }

    return { status: connection.status, phone: connection.phone };
  }

  async disconnect(companyId: string) {
    const sock = this.connections.get(companyId);

    if (sock) {
      try {
        sock.end(undefined);
      } catch (error) {
        this.logger.warn(`Erro ao encerrar sessão: ${error.message}`);
      }
      this.connections.delete(companyId);
      this.qrCodes.delete(companyId);
    }

    const sessionDir = path.join(this.sessionsDir, companyId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    return this.prisma.whatsAppConnection.updateMany({
      where: { companyId },
      data: {
        status: 'DISCONNECTED',
        qrcode: null,
      },
    });
  }

  async sendMessage(phone: string, message: string, companyId: string) {
    const sock = this.connections.get(companyId);

    if (!sock?.user) {
      throw new Error('WhatsApp não conectado');
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: message });

    this.logger.log(`Mensagem enviada para ${phone} da empresa ${companyId}`);
  }

  private async handleIncomingMessage(companyId: string, msg: proto.IWebMessageInfo) {
    const fromMe = msg.key?.fromMe;
    if (fromMe) return;

    const phone = msg.key?.remoteJid?.replace('@s.whatsapp.net', '')?.replace('@lid', '');
    if (!phone) return;

    const messageContent =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      '';

    if (!messageContent) return;

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { aiConfig: true },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        whatsappConnectionId: connection.id,
        clientPhone: phone,
        status: 'ACTIVE',
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId,
          whatsappConnectionId: connection.id,
          clientPhone: phone,
          mode: company?.aiConfig?.isActive ? 'AI' : 'FLOW',
          status: 'ACTIVE',
        },
      });
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        content: messageContent,
        direction: 'INBOUND',
        sender: 'CLIENT',
      },
    });

    if (conversation.mode === 'HUMAN') return;

    let botResponse: string | null = null;

    if (conversation.mode === 'AI' && company?.aiConfig?.isActive) {
      try {
        const { AIService } = await import('../ai/ai.service');
        const aiService = new AIService(
          this.prisma,
          this.httpService,
          this.configService,
        );
        const result = await aiService.chat(conversation.id, messageContent, companyId);
        botResponse = result.response;
      } catch (error) {
        this.logger.error(`Falha no chat com IA: ${error.message}`);
        botResponse = 'Desculpe, estou com dificuldades no momento. Por favor, tente novamente.';
      }
    } else if (conversation.mode === 'FLOW') {
      const activeFlow = await this.prisma.flow.findFirst({
        where: { companyId, isActive: true },
      });

      if (activeFlow) {
        try {
          const { FlowsService } = await import('../flows/flows.service');
          const flowsService = new FlowsService(this.prisma);
          const result = await flowsService.execute(conversation.id, messageContent, companyId);
          botResponse = result.response;
        } catch (error) {
          this.logger.error(`Falha na execução do fluxo: ${error.message}`);
          botResponse = 'Desculpe, ocorreu um erro. Por favor, tente novamente.';
        }
      } else {
        botResponse = 'Olá! Como posso ajudá-lo?';
      }
    }

    if (botResponse) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: botResponse,
          direction: 'OUTBOUND',
          sender: 'BOT',
        },
      });

      await this.sendMessage(phone, botResponse, companyId);
    }
  }
}
