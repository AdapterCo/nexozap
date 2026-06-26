import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/security/encryption.service';
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
import QRCode = require('qrcode');
import pino from 'pino';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly sessionsDir: string;

  private connections: Map<string, WASocket> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private connectionStatus: Map<string, string> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  private readonly emptyQrResponse = {
    qrcode: '',
    qrCode: '',
    message: 'QR Code ainda não disponível',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly encryption: EncryptionService,
  ) {
    this.sessionsDir = path.resolve(
      this.configService.get<string>(
        'SESSIONS_DIR',
        path.join(process.cwd(), 'whatsapp-sessions'),
      ),
    );

    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async onModuleInit() {
    setTimeout(() => {
      this.reconnectActiveSessions().catch((err) => {
        this.logger.error(
          `Erro ao reconectar sessões ativas no startup: ${this.getErrorMessage(err)}`,
        );
      });
    }, 5000);
  }

  async onModuleDestroy() {
    for (const [, sock] of this.connections) {
      try {
        sock.end(undefined);
      } catch (err) {
        this.logger.warn(`Erro ao encerrar socket no shutdown: ${this.getErrorMessage(err)}`);
      }
    }

    for (const [, timer] of this.reconnectTimers) {
      clearTimeout(timer);
    }

    this.connections.clear();
    this.qrCodes.clear();
    this.connectionStatus.clear();
    this.reconnectTimers.clear();
  }

  private async reconnectActiveSessions() {
    const activeConns = await this.prisma.whatsAppConnection.findMany({
      where: { status: 'CONNECTED' },
    });

    this.logger.log(`Encontradas ${activeConns.length} conexões ativas para reconectar.`);

    for (const conn of activeConns) {
      try {
        await this.connect(conn.companyId);
      } catch (err) {
        this.logger.error(
          `Falha ao autoreconectar ${conn.companyId}: ${this.getErrorMessage(err)}`,
        );
      }
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;

    if (typeof error === 'string') return error;

    try {
      const serialized = JSON.stringify(error);

      return serialized || 'Erro desconhecido';
    } catch {
      return 'Erro desconhecido';
    }
  }

  private getDisconnectInfo(lastDisconnect: ConnectionState['lastDisconnect']) {
    const error = lastDisconnect?.error as any;

    return {
      statusCode: error?.output?.statusCode,
      message: error?.message || this.getErrorMessage(error),
    };
  }

  private ensureValidSessionFolder(companyId: string, authFolder: string) {
    if (!fs.existsSync(authFolder)) return;

    const invalidFiles: string[] = [];
    const files = fs.readdirSync(authFolder, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;

      const filePath = path.join(authFolder, file.name);

      try {
        const raw = fs.readFileSync(filePath, 'utf8').trim();

        if (!raw) continue;

        const parsed = JSON.parse(raw);

        if (parsed === null || typeof parsed !== 'object') {
          invalidFiles.push(file.name);
        }
      } catch (err) {
        invalidFiles.push(`${file.name}: ${this.getErrorMessage(err)}`);
      }
    }

    if (invalidFiles.length === 0) return;

    this.logger.warn(
      `Sessão WhatsApp corrompida para ${companyId}. Removendo pasta ${authFolder}. Arquivos inválidos: ${invalidFiles.join(', ')}`,
    );

    fs.rmSync(authFolder, { recursive: true, force: true });
  }

  private async endSocket(companyId: string, sock: WASocket) {
    try {
      sock.end(undefined);
    } catch (err) {
      this.logger.warn(`Erro ao encerrar socket de ${companyId}: ${this.getErrorMessage(err)}`);
    }
  }

  private normalizeQrCode(qr?: string | null): string {
    if (!qr) return '';

    const normalized = qr.trim();

    if (!normalized || normalized === 'null' || normalized === 'undefined') {
      return '';
    }

    return normalized;
  }

  private getConnectedPhoneFromSocket(sock?: WASocket): string {
    return sock?.user?.id?.split(':')[0]?.split('@')[0] || '';
  }

  async connect(companyId: string) {
    if (this.connections.has(companyId) && this.connectionStatus.get(companyId) === 'open') {
      const phone = await this.getConnectedPhone(companyId);
      return {
        status: 'CONNECTED',
        message: 'Sessão já ativa',
        phone: phone || '',
        qrcode: '',
        qrCode: '',
      };
    }

    if (this.reconnectTimers.has(companyId)) {
      clearTimeout(this.reconnectTimers.get(companyId));
      this.reconnectTimers.delete(companyId);
    }

    const existingSock = this.connections.get(companyId);
    if (existingSock) {
      await this.endSocket(companyId, existingSock);
      this.connections.delete(companyId);
    }

    this.connectionStatus.set(companyId, 'connecting');
    this.qrCodes.delete(companyId);

    await this.upsertConnection(companyId, 'RECONNECTING', { qrcode: null });

    try {
      await this.startSocket(companyId);
      const qr = await this.waitForQRCode(companyId, 4000);

      return {
        status: 'RECONNECTING',
        message: qr ? 'QR Code gerado' : 'Conectando... aguarde o QR Code',
        phone: '',
        qrcode: qr || '',
        qrCode: qr || '',
      };
    } catch (err) {
      const message = this.getErrorMessage(err);

      this.logger.error(`Falha ao iniciar socket para ${companyId}: ${message}`);

      this.connectionStatus.set(companyId, 'disconnected');
      this.qrCodes.delete(companyId);

      await this.upsertConnection(companyId, 'DISCONNECTED', { qrcode: null });

      return {
        status: 'DISCONNECTED',
        message,
        phone: '',
        qrcode: '',
        qrCode: '',
      };
    }
  }

  private async startSocket(companyId: string) {
    const authFolder = path.join(this.sessionsDir, companyId);

    let state: any;
    let saveCreds: () => Promise<void>;

    this.ensureValidSessionFolder(companyId, authFolder);

    try {
      const authResult = await useMultiFileAuthState(authFolder);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    } catch (error) {
      this.logger.error(
        `Erro ao carregar sessão para ${companyId}: ${this.getErrorMessage(error)}`,
      );

      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
      }

      const authResult = await useMultiFileAuthState(authFolder);
      state = authResult.state;
      saveCreds = authResult.saveCreds;
    }

    let version: [number, number, number] | undefined;

    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
      this.logger.log(`Baileys versão usada: ${version.join('.')}`);
    } catch (err) {
      this.logger.warn(
        `Não foi possível buscar versão do Baileys: ${this.getErrorMessage(err)}`,
      );
    }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      printQRInTerminal: false,
      browser: ['NexoZap', 'Chrome', '1.0.0'],
      logger: pino({ level: 'silent' }),
    });

    this.connections.set(companyId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;
      const disconnectInfo = this.getDisconnectInfo(lastDisconnect);

      this.logger.log(
        `connection.update ${companyId}: ${JSON.stringify({
          connection,
          hasQr: !!qr,
          statusCode: disconnectInfo.statusCode,
          error: disconnectInfo.message,
        })}`,
      );

      if (qr) {
        try {
          const qrImage = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
          });

          this.qrCodes.set(companyId, qrImage);
          this.connectionStatus.set(companyId, 'qr');

          await this.upsertConnection(companyId, 'RECONNECTING', {
            qrcode: qrImage,
          });

          this.logger.log(`QR Code gerado para empresa ${companyId}`);
        } catch (err) {
          this.logger.error(`Erro ao converter QR Code: ${this.getErrorMessage(err)}`);
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0] || '';

        this.qrCodes.delete(companyId);
        this.connectionStatus.set(companyId, 'open');

        await this.upsertConnection(companyId, 'CONNECTED', {
          qrcode: null,
          phone,
        });

        this.logger.log(`WhatsApp conectado para empresa ${companyId}, telefone: ${phone}`);
      }

      if (connection === 'close') {
        const statusCode = disconnectInfo.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.connections.delete(companyId);

        if (shouldReconnect) {
          const existingQr = this.qrCodes.get(companyId) || '';

          this.connectionStatus.set(companyId, existingQr ? 'qr' : 'connecting');

          await this.upsertConnection(companyId, 'RECONNECTING', {
            ...(existingQr ? { qrcode: existingQr } : {}),
          });
        } else {
          this.qrCodes.delete(companyId);
          this.connectionStatus.set(companyId, 'disconnected');

          if (fs.existsSync(authFolder)) {
            fs.rmSync(authFolder, { recursive: true, force: true });
          }

          await this.upsertConnection(companyId, 'DISCONNECTED', {
            qrcode: null,
          });
        }

        this.logger.warn(
          `WhatsApp fechado para ${companyId}. StatusCode: ${statusCode}. Erro: ${disconnectInfo.message}. Reconectar: ${shouldReconnect}`,
        );

        if (shouldReconnect) {
          const timer = setTimeout(() => {
            this.reconnectTimers.delete(companyId);

            this.connect(companyId).catch((err) => {
              this.logger.error(`Falha ao reconectar ${companyId}: ${this.getErrorMessage(err)}`);
            });
          }, 5000);

          this.reconnectTimers.set(companyId, timer);
        }
      }
    });

    sock.ev.on('messages.upsert', async (msgUpdate) => {
      if (msgUpdate.type !== 'notify') return;

      for (const msg of msgUpdate.messages) {
        try {
          await this.handleMessage(companyId, msg);
        } catch (error) {
          this.logger.error(`Erro ao processar mensagem: ${this.getErrorMessage(error)}`);
        }
      }
    });
  }

  private async waitForQRCode(companyId: string, timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const qr = this.normalizeQrCode(this.qrCodes.get(companyId));

      if (qr) {
        return qr;
      }

      const conn = await this.prisma.whatsAppConnection.findFirst({
        where: { companyId },
      });

      const persistedQr = this.normalizeQrCode(conn?.qrcode);

      if (persistedQr) {
        this.qrCodes.set(companyId, persistedQr);
        return persistedQr;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return null;
  }

  async getQRCode(companyId: string) {
    const qr = await this.waitForQRCode(companyId, 10000);

    if (qr) {
      return {
        qrcode: qr,
        qrCode: qr,
      };
    }

    return this.emptyQrResponse;
  }

  async getStatus(companyId: string) {
    const status = this.connectionStatus.get(companyId);
    const sock = this.connections.get(companyId);

    if (sock?.user && status === 'open') {
      const phone = this.getConnectedPhoneFromSocket(sock);

      return {
        status: 'CONNECTED',
        phone,
        qrcode: '',
        qrCode: '',
      };
    }

    if (status === 'qr' || status === 'connecting') {
      const qr = this.normalizeQrCode(this.qrCodes.get(companyId));

      return {
        status: 'RECONNECTING',
        phone: '',
        qrcode: qr,
        qrCode: qr,
      };
    }

    const conn = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (conn?.status === 'CONNECTED') {
      return {
        status: 'CONNECTED',
        phone: conn.phone || '',
        qrcode: '',
        qrCode: '',
      };
    }

    if (conn?.status === 'RECONNECTING') {
      const qr = this.normalizeQrCode(conn.qrcode);

      if (qr) {
        this.qrCodes.set(companyId, qr);
      }

      return {
        status: 'RECONNECTING',
        phone: '',
        qrcode: qr,
        qrCode: qr,
      };
    }

    return {
      status: 'DISCONNECTED',
      phone: '',
      qrcode: '',
      qrCode: '',
    };
  }

  private async getConnectedPhone(companyId: string): Promise<string> {
    const conn = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    return conn?.phone || '';
  }

  private async upsertConnection(
    companyId: string,
    status: string,
    extra?: { qrcode?: string | null; phone?: string },
  ) {
    const existing = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    const data: any = {
      status,
      instanceName: companyId,
    };

    if (extra?.qrcode !== undefined) {
      data.qrcode = extra.qrcode;
    }

    if (extra?.phone !== undefined) {
      data.phone = extra.phone;
    }

    if (existing) {
      await this.prisma.whatsAppConnection.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.whatsAppConnection.create({
        data: {
          companyId,
          ...data,
        },
      });
    }
  }

  async disconnect(companyId: string) {
    if (this.reconnectTimers.has(companyId)) {
      clearTimeout(this.reconnectTimers.get(companyId));
      this.reconnectTimers.delete(companyId);
    }

    const sock = this.connections.get(companyId);

    if (sock) {
      await this.endSocket(companyId, sock);

      this.connections.delete(companyId);
    }

    this.qrCodes.delete(companyId);
    this.connectionStatus.delete(companyId);

    const sessionDir = path.join(this.sessionsDir, companyId);

    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    await this.prisma.whatsAppConnection.updateMany({
      where: { companyId },
      data: {
        status: 'DISCONNECTED',
        qrcode: null,
        phone: null,
      },
    });

    return {
      status: 'DISCONNECTED',
      phone: '',
      qrcode: '',
      qrCode: '',
    };
  }

  async sendMessage(phoneOrJid: string, message: string, companyId: string) {
    const sock = this.connections.get(companyId);

    if (!sock?.user) {
      throw new Error('WhatsApp não conectado');
    }

    const jid = phoneOrJid.includes('@')
      ? phoneOrJid
      : `${phoneOrJid}@s.whatsapp.net`;

    try {
      await sock.sendMessage(jid, { text: message });
    } catch (err) {
      if (jid.endsWith('@s.whatsapp.net')) {
        await sock.sendMessage(jid.replace('@s.whatsapp.net', '@lid'), {
          text: message,
        });
        return;
      }

      throw err;
    }
  }

  private getMessageContent(message: proto.IMessage | null | undefined): proto.IMessage | null {
    if (!message) return null;

    if (message.ephemeralMessage?.message) {
      return this.getMessageContent(message.ephemeralMessage.message);
    }

    if (message.viewOnceMessage?.message) {
      return this.getMessageContent(message.viewOnceMessage.message);
    }

    if (message.viewOnceMessageV2?.message) {
      return this.getMessageContent(message.viewOnceMessageV2.message);
    }

    return message;
  }

  private async handleMessage(companyId: string, msg: proto.IWebMessageInfo) {
    if (msg.key?.fromMe) return;

    const remoteJid = msg.key?.remoteJid;

    if (!remoteJid) return;
    if (remoteJid.endsWith('@g.us')) return;
    if (remoteJid === 'status@broadcast') return;

    const cleanPhone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '');

    const contentMsg = this.getMessageContent(msg.message);

    const content =
      contentMsg?.conversation ||
      contentMsg?.extendedTextMessage?.text ||
      contentMsg?.buttonsResponseMessage?.selectedButtonId ||
      contentMsg?.buttonsResponseMessage?.selectedDisplayText ||
      contentMsg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      contentMsg?.listResponseMessage?.title ||
      contentMsg?.imageMessage?.caption ||
      contentMsg?.videoMessage?.caption ||
      '';

    if (!content) return;

    const conn = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!conn) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { aiConfig: true },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        whatsappConnectionId: conn.id,
        OR: [{ clientJid: remoteJid }, { clientPhone: cleanPhone }],
        status: 'ACTIVE',
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId,
          whatsappConnectionId: conn.id,
          clientPhone: cleanPhone,
          clientJid: remoteJid,
          mode: company?.aiConfig?.isActive ? 'AI' : 'FLOW',
          status: 'ACTIVE',
        },
      });
    } else if (conversation.clientJid !== remoteJid) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { clientJid: remoteJid },
      });
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        content,
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
          this.encryption,
        );

        const result = await aiService.chat(conversation.id, content, companyId);

        botResponse = result.response;
      } catch (error) {
        this.logger.error(`Falha no chat IA: ${this.getErrorMessage(error)}`);
        botResponse = 'Desculpe, estou com dificuldades no momento.';
      }
    } else if (conversation.mode === 'FLOW') {
      const activeFlow = await this.prisma.flow.findFirst({
        where: {
          companyId,
          isActive: true,
        },
      });

      if (activeFlow) {
        try {
          const { FlowsService } = await import('../flows/flows.service');

          const flowsService = new FlowsService(this.prisma);
          const result = await flowsService.execute(conversation.id, content, companyId);

          botResponse = result.response;
        } catch (error) {
          this.logger.error(`Falha no fluxo: ${this.getErrorMessage(error)}`);
          botResponse = 'Desculpe, ocorreu um erro.';
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

      await this.sendMessage(remoteJid, botResponse, companyId);
    }
  }
}
