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
      return {
        status: existing?.status || 'CONNECTED',
        message: 'Sessão já está ativa',
      };
    }

    const sessionDir = path.join(this.sessionsDir, companyId);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['NexoZap', 'Chrome', '4.0.0'],
      generateHighQualityLinkPreview: false,
    });

    this.connections.set(companyId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCodes.set(companyId, qr);
        const existingConn = await this.prisma.whatsAppConnection.findFirst({
          where: { companyId },
        });
        if (existingConn) {
          await this.prisma.whatsAppConnection.update({
            where: { id: existingConn.id },
            data: { status: 'RECONNECTING', qrcode: qr },
          });
        } else {
          await this.prisma.whatsAppConnection.create({
            data: {
              companyId,
              instanceName: companyId,
              status: 'RECONNECTING',
              qrcode: qr,
            },
          });
        }
        this.logger.log(`QR Code generated for company ${companyId}`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.logger.log(`Connection closed for ${companyId}, status: ${statusCode}, reconnect: ${shouldReconnect}`);

        await this.prisma.whatsAppConnection.updateMany({
          where: { companyId },
          data: { status: 'DISCONNECTED', qrcode: null },
        });

        this.connections.delete(companyId);
        this.qrCodes.delete(companyId);

        if (shouldReconnect) {
          setTimeout(() => this.connect(companyId), 5000);
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || '';

        const existingConn2 = await this.prisma.whatsAppConnection.findFirst({
          where: { companyId },
        });
        if (existingConn2) {
          await this.prisma.whatsAppConnection.update({
            where: { id: existingConn2.id },
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

        this.qrCodes.delete(companyId);
        this.logger.log(`Connected for company ${companyId}, phone: ${phone}`);
      }
    });

    sock.ev.on('messages.upsert', async (messageUpdate) => {
      if (messageUpdate.type !== 'notify') return;

      for (const msg of messageUpdate.messages) {
        await this.handleIncomingMessage(companyId, msg);
      }
    });

    const existingConn3 = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });
    if (existingConn3) {
      await this.prisma.whatsAppConnection.update({
        where: { id: existingConn3.id },
        data: { status: 'RECONNECTING', instanceName: companyId },
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

    return { status: 'RECONNECTING', message: 'Conectando... escaneie o QR Code' };
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
    const qrCode = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });

    return { qrcode: qr, qrCode };
  }

  async getStatus(companyId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) {
      return { status: 'DISCONNECTED', phone: null };
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
        this.logger.warn(`Error ending session: ${error.message}`);
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

    this.logger.log(`Message sent to ${phone} for company ${companyId}`);
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
        const { EncryptionService } = await import('../common/security/encryption.service');
        const aiService = new AIService(
          this.prisma,
          this.httpService,
          this.configService,
          new EncryptionService(this.configService),
        );
        const result = await aiService.chat(conversation.id, messageContent, companyId);
        botResponse = result.response;
      } catch (error) {
        this.logger.error(`AI chat failed: ${error.message}`);
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
          this.logger.error(`Flow execution failed: ${error.message}`);
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
