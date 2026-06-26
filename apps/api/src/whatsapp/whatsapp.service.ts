import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
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
  private connectionStatus: Map<string, string> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

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
      try { sock.end(undefined); } catch {}
    }
    for (const [, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }
    this.connections.clear();
    this.qrCodes.clear();
    this.connectionStatus.clear();
    this.reconnectTimers.clear();
  }

  async connect(companyId: string) {
    if (this.connections.has(companyId) && this.connectionStatus.get(companyId) === 'open') {
      const phone = await this.getConnectedPhone(companyId);
      return { status: 'CONNECTED', message: 'Sessão já ativa', phone };
    }

    if (this.reconnectTimers.has(companyId)) {
      clearTimeout(this.reconnectTimers.get(companyId));
      this.reconnectTimers.delete(companyId);
    }

    this.connectionStatus.set(companyId, 'connecting');
    this.qrCodes.delete(companyId);

    await this.upsertConnection(companyId, 'RECONNECTING');

    this.startSocket(companyId).catch((err) => {
      this.logger.error(`Falha ao iniciar socket para ${companyId}: ${err.message}`);
    });

    return { status: 'RECONNECTING', message: 'Conectando... escaneie o QR Code' };
  }

  private async startSocket(companyId: string) {
    const authFolder = path.join(this.sessionsDir, companyId);

    let state: any;
    let saveCreds: () => Promise<void>;

    try {
      const authResult = await useMultiFileAuthState(authFolder);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    } catch (error) {
      this.logger.error(`Erro ao carregar sessão para ${companyId}: ${error.message}`);
      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
      }
      const authResult = await useMultiFileAuthState(authFolder);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    }

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: { level: 'silent' } as any,
    });

    this.connections.set(companyId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr, { margin: 2, width: 320 });
          this.qrCodes.set(companyId, qrImage);
          this.connectionStatus.set(companyId, 'qr');
          await this.upsertConnection(companyId, 'RECONNECTING', { qrcode: qrImage });
          this.logger.log(`QR Code gerado para empresa ${companyId}`);
        } catch (err) {
          this.logger.error(`Erro ao gerar QR Code: ${err.message}`);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.connections.delete(companyId);
        this.qrCodes.delete(companyId);
        this.connectionStatus.set(companyId, 'disconnected');

        await this.upsertConnection(companyId, 'DISCONNECTED', { qrcode: null });

        if (shouldReconnect) {
          this.logger.log(`Reconectando ${companyId} em 5s...`);
          const timer = setTimeout(() => {
            this.reconnectTimers.delete(companyId);
            this.connect(companyId).catch((err) => {
              this.logger.error(`Falha ao reconectar: ${err.message}`);
            });
          }, 5000);
          this.reconnectTimers.set(companyId, timer);
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0] || '';

        this.qrCodes.delete(companyId);
        this.connectionStatus.set(companyId, 'open');

        await this.upsertConnection(companyId, 'CONNECTED', { qrcode: null, phone });

        this.logger.log(`Conectado para empresa ${companyId}, telefone: ${phone}`);
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

  private async getConnectedPhone(companyId: string): Promise<string | null> {
    const conn = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    return conn?.phone || null;
  }

  private async upsertConnection(
    companyId: string,
    status: string,
    extra?: { qrcode?: string | null; phone?: string },
  ) {
    const existing = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    const data: any = { status, instanceName: companyId };
    if (extra?.qrcode !== undefined) data.qrcode = extra.qrcode;
    if (extra?.phone !== undefined) data.phone = extra.phone;

    if (existing) {
      await this.prisma.whatsAppConnection.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.whatsAppConnection.create({ data: { companyId, ...data } });
    }
  }

  async getQRCode(companyId: string) {
    const qr = this.qrCodes.get(companyId);
    if (qr) return { qrcode: qr, qrCode: qr };

    const conn = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    if (conn?.qrcode) return { qrcode: conn.qrcode, qrCode: conn.qrcode };

    return { qrcode: null, qrCode: null };
  }

  async getStatus(companyId: string) {
    const status = this.connectionStatus.get(companyId);
    const sock = this.connections.get(companyId);
    const isConnected = sock?.user != null;

    if (isConnected) {
      const phone = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
      return { status: 'CONNECTED', phone };
    }

    if (status === 'qr' || status === 'connecting') {
      const qr = this.qrCodes.get(companyId);
      return { status: 'RECONNECTING', phone: null, qrCode: qr || null };
    }

    const conn = await this.prisma.whatsAppConnection.findFirst({ where: { companyId } });
    if (conn) {
      if (conn.status === 'RECONNECTING' && conn.qrcode) {
        return { status: 'RECONNECTING', phone: conn.phone, qrCode: conn.qrcode };
      }
      if (conn.status === 'CONNECTED') {
        return { status: 'CONNECTED', phone: conn.phone };
      }
      if (conn.status === 'RECONNECTING' && !conn.qrcode) {
        await this.prisma.whatsAppConnection.update({
          where: { id: conn.id },
          data: { status: 'DISCONNECTED' },
        });
        return { status: 'DISCONNECTED', phone: null };
      }
    }

    return { status: 'DISCONNECTED', phone: null };
  }

  async disconnect(companyId: string) {
    if (this.reconnectTimers.has(companyId)) {
      clearTimeout(this.reconnectTimers.get(companyId));
      this.reconnectTimers.delete(companyId);
    }

    const sock = this.connections.get(companyId);
    if (sock) {
      try { sock.end(undefined); } catch {}
      this.connections.delete(companyId);
      this.qrCodes.delete(companyId);
      this.connectionStatus.delete(companyId);
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
