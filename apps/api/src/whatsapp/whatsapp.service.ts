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
    this.sessionsDir = path.resolve(
      this.configService.get<string>('SESSIONS_DIR', path.join(process.cwd(), 'whatsapp-sessions')),
    );
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async onModuleDestroy() {
    for (const [companyId, sock] of this.connections) {
      try {
        sock.end(undefined);
      } catch {}
    }
    this.connections.clear();
  }

  async connect(companyId: string) {
    if (this.connections.has(companyId)) {
      const sock = this.connections.get(companyId);
      if (sock?.user) {
        return { status: 'CONNECTED', message: 'Sessão já ativa' };
      }
      const qr = this.qrCodes.get(companyId);
      if (qr) {
        return this.formatQRCode(qr);
      }
      return { status: 'RECONNECTING', message: 'Aguardando QR Code...' };
    }

    const sessionDir = path.join(this.sessionsDir, companyId);
    let state: any;
    let saveCreds: () => Promise<void>;

    try {
      const authResult = await useMultiFileAuthState(sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    } catch (error) {
      this.logger.error(`Erro ao carregar sessão para ${companyId}: ${error.message}`);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      const authResult = await useMultiFileAuthState(sessionDir);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    }

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['NexoZap', 'Chrome', '4.0.0'],
    });

    this.connections.set(companyId, sock);
    sock.ev.on('creds.update', saveCreds);

    await this.upsertConnection(companyId, 'RECONNECTING');
    this.setupEvents(companyId, sock);

    const qr = await this.waitForQR(companyId, 20000);
    if (qr) {
      return this.formatQRCode(qr);
    }

    if (sock.user) {
      return { status: 'CONNECTED', message: 'Conectado com sessão existente' };
    }

    return { status: 'RECONNECTING', message: 'Escaneie o QR Code no WhatsApp' };
  }

  private async waitForQR(companyId: string, timeoutMs: number): Promise<string | null> {
    const existing = this.qrCodes.get(companyId);
    if (existing) return existing;

    return new Promise((resolve) => {
      let resolved = false;
      const check = setInterval(() => {
        const qr = this.qrCodes.get(companyId);
        if (qr && !resolved) {
          resolved = true;
          clearInterval(check);
          clearTimeout(timer);
          resolve(qr);
        }
      }, 300);

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          clearInterval(check);
          resolve(null);
        }
      }, timeoutMs);

      const sock = this.connections.get(companyId);
      if (sock) {
        const connCheck = setInterval(() => {
          if (sock.user && !resolved) {
            resolved = true;
            clearInterval(check);
            clearInterval(connCheck);
            clearTimeout(timer);
            resolve(null);
          }
        }, 500);
        setTimeout(() => clearInterval(connCheck), timeoutMs);
      }
    });
  }

  private setupEvents(companyId: string, sock: WASocket) {
    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCodes.set(companyId, qr);
        await this.upsertConnection(companyId, 'RECONNECTING', { qrcode: qr });
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        this.connections.delete(companyId);
        this.qrCodes.delete(companyId);

        if (shouldReconnect) {
          await this.upsertConnection(companyId, 'RECONNECTING', { qrcode: null });
          setTimeout(() => this.connect(companyId).catch(() => {}), 3000);
        } else {
          await this.upsertConnection(companyId, 'DISCONNECTED', { qrcode: null });
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || '';
        this.qrCodes.delete(companyId);
        await this.upsertConnection(companyId, 'CONNECTED', { qrcode: null, phone });
      }
    });

    sock.ev.on('messages.upsert', async (msgUpdate) => {
      if (msgUpdate.type !== 'notify') return;
      for (const msg of msgUpdate.messages) {
        try {
          await this.handleMessage(companyId, msg);
        } catch (error) {
          this.logger.error(`Erro ao processar mensagem: ${error.message}`);
        }
      }
    });
  }

  private async upsertConnection(
    companyId: string,
    status: string,
    extra?: { qrcode?: string | null; phone?: string },
  ) {
    const existing = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    const data: any = { status, instanceName: companyId, ...extra };
    if (extra?.qrcode === undefined) delete data.qrcode;

    if (existing) {
      await this.prisma.whatsAppConnection.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.whatsAppConnection.create({
        data: { companyId, instanceName: companyId, status, ...extra },
      });
    }
  }

  async getQRCode(companyId: string) {
    const qr = this.qrCodes.get(companyId);
    if (qr) return this.formatQRCode(qr);

    const conn = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    if (conn?.qrcode) return this.formatQRCode(conn.qrcode);

    return { qrcode: null, qrCode: null };
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
      this.logger.error(`Erro ao gerar imagem QR: ${error.message}`);
      return { qrcode: qr, qrCode: null };
    }
  }

  async getStatus(companyId: string) {
    const conn = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });

    if (!conn) {
      return { status: 'DISCONNECTED', phone: null };
    }

    if (conn.status === 'RECONNECTING') {
      const sock = this.connections.get(companyId);
      const qr = this.qrCodes.get(companyId);
      if (!sock && !qr && !conn.qrcode) {
        await this.prisma.whatsAppConnection.update({
          where: { id: conn.id },
          data: { status: 'DISCONNECTED' },
        });
        return { status: 'DISCONNECTED', phone: null };
      }
      if (conn.qrcode) {
        const formatted = await this.formatQRCode(conn.qrcode);
        return { status: 'RECONNECTING', phone: conn.phone, ...formatted };
      }
    }

    const sock = this.connections.get(companyId);
    const isConnected = sock?.user != null;

    if (isConnected && conn.status !== 'CONNECTED') {
      await this.prisma.whatsAppConnection.update({
        where: { id: conn.id },
        data: { status: 'CONNECTED', qrcode: null },
      });
      return { status: 'CONNECTED', phone: conn.phone };
    }

    if (!isConnected && conn.status === 'CONNECTED') {
      await this.prisma.whatsAppConnection.update({
        where: { id: conn.id },
        data: { status: 'DISCONNECTED' },
      });
      return { status: 'DISCONNECTED', phone: null };
    }

    return { status: conn.status, phone: conn.phone };
  }

  async disconnect(companyId: string) {
    const sock = this.connections.get(companyId);
    if (sock) {
      try { sock.end(undefined); } catch {}
      this.connections.delete(companyId);
      this.qrCodes.delete(companyId);
    }

    const sessionDir = path.join(this.sessionsDir, companyId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    await this.prisma.whatsAppConnection.updateMany({
      where: { companyId },
      data: { status: 'DISCONNECTED', qrcode: null },
    });

    return { status: 'DISCONNECTED' };
  }

  async sendMessage(phone: string, message: string, companyId: string) {
    const sock = this.connections.get(companyId);
    if (!sock?.user) throw new Error('WhatsApp não conectado');

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
  }

  private async handleMessage(companyId: string, msg: proto.IWebMessageInfo) {
    if (msg.key?.fromMe) return;

    const phone = msg.key?.remoteJid?.replace('@s.whatsapp.net', '')?.replace('@lid', '');
    if (!phone) return;

    const content =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      '';
    if (!content) return;

    const conn = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    if (!conn) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { aiConfig: true },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: { whatsappConnectionId: conn.id, clientPhone: phone, status: 'ACTIVE' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId,
          whatsappConnectionId: conn.id,
          clientPhone: phone,
          mode: company?.aiConfig?.isActive ? 'AI' : 'FLOW',
          status: 'ACTIVE',
        },
      });
    }

    await this.prisma.message.create({
      data: { conversationId: conversation.id, content, direction: 'INBOUND', sender: 'CLIENT' },
    });

    if (conversation.mode === 'HUMAN') return;

    let botResponse: string | null = null;

    if (conversation.mode === 'AI' && company?.aiConfig?.isActive) {
      try {
        const { AIService } = await import('../ai/ai.service');
        const aiService = new AIService(this.prisma, this.httpService, this.configService);
        const result = await aiService.chat(conversation.id, content, companyId);
        botResponse = result.response;
      } catch (error) {
        this.logger.error(`Falha no chat IA: ${error.message}`);
        botResponse = 'Desculpe, estou com dificuldades no momento.';
      }
    } else if (conversation.mode === 'FLOW') {
      const activeFlow = await this.prisma.flow.findFirst({
        where: { companyId, isActive: true },
      });
      if (activeFlow) {
        try {
          const { FlowsService } = await import('../flows/flows.service');
          const flowsService = new FlowsService(this.prisma);
          const result = await flowsService.execute(conversation.id, content, companyId);
          botResponse = result.response;
        } catch (error) {
          this.logger.error(`Falha no fluxo: ${error.message}`);
          botResponse = 'Desculpe, ocorreu um erro.';
        }
      } else {
        botResponse = 'Olá! Como posso ajudá-lo?';
      }
    }

    if (botResponse) {
      await this.prisma.message.create({
        data: { conversationId: conversation.id, content: botResponse, direction: 'OUTBOUND', sender: 'BOT' },
      });
      await this.sendMessage(phone, botResponse, companyId);
    }
  }
}
