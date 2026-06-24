import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL', '');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY', '');
  }

  private get headers() {
    return { apikey: this.apiKey };
  }

  async connect(companyId: string, instanceName: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/instance/create`,
          {
            instanceName,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            rejectCall: false,
            groupsIgnore: true,
            alwaysOnline: false,
            readMessages: true,
            readStatus: false,
            syncFullHistory: false,
          },
          { headers: this.headers },
        ),
      );

      const connection = await this.prisma.whatsAppConnection.upsert({
        where: { companyId },
        update: {
          instanceName,
          instanceId: response.data?.instance?.instanceId || null,
          status: 'DISCONNECTED',
          qrcode: null,
        },
        create: {
          companyId,
          instanceName,
          instanceId: response.data?.instance?.instanceId || null,
          status: 'DISCONNECTED',
        },
      });

      return connection;
    } catch (error) {
      this.logger.error(`Failed to connect WhatsApp instance: ${error.message}`);
      throw new InternalServerErrorException('Falha ao conectar instância WhatsApp');
    }
  }

  async getQRCode(companyId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) {
      throw new InternalServerErrorException('Conexão WhatsApp não encontrada');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/instance/connect/${connection.instanceName}`,
          { headers: this.headers },
        ),
      );

      const qrCode = response.data?.base64;
      if (qrCode) {
        await this.prisma.whatsAppConnection.update({
          where: { id: connection.id },
          data: { qrcode: qrCode },
        });
      }

      return { qrcode: qrCode || connection.qrcode };
    } catch (error) {
      this.logger.error(`Failed to get QR code: ${error.message}`);
      if (connection.qrcode) {
        return { qrcode: connection.qrcode };
      }
      throw new InternalServerErrorException('Falha ao obter QR Code');
    }
  }

  async getStatus(companyId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) {
      return { status: 'DISCONNECTED', instance: null };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/instance/connectionState/${connection.instanceName}`,
          { headers: this.headers },
        ),
      );

      const state = response.data?.state;
      let status: string = 'DISCONNECTED';
      if (state === 'open') {
        status = 'CONNECTED';
      } else if (state === 'connecting') {
        status = 'RECONNECTING';
      }

      await this.prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: status as any },
      });

      return { status, phone: connection.phone, instanceName: connection.instanceName };
    } catch (error) {
      this.logger.error(`Failed to get status: ${error.message}`);
      return { status: connection.status, phone: connection.phone, instanceName: connection.instanceName };
    }
  }

  async disconnect(companyId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) {
      throw new InternalServerErrorException('Conexão WhatsApp não encontrada');
    }

    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.apiUrl}/instance/delete/${connection.instanceName}`,
          { headers: this.headers },
        ),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete remote instance: ${error.message}`);
    }

    return this.prisma.whatsAppConnection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        qrcode: null,
      },
    });
  }

  async handleIncomingMessage(data: any) {
    const instanceName = data.instance || data.instanceName;
    const phone = data.data?.key?.remoteJid?.replace('@s.whatsapp.net', '')?.replace('@lid', '');
    const messageContent = data.data?.message?.conversation
      || data.data?.message?.extendedTextMessage?.text
      || '';
    const fromMe = data.data?.key?.fromMe;

    if (!phone || fromMe || !messageContent) {
      return null;
    }

    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { instanceName },
    });

    if (!connection) {
      this.logger.warn(`No connection found for instance: ${instanceName}`);
      return null;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: connection.companyId },
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
          companyId: connection.companyId,
          whatsappConnectionId: connection.id,
          clientPhone: phone,
          mode: company.aiConfig?.isActive ? 'AI' : 'FLOW',
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

    let botResponse: string | null = null;

    if (conversation.mode === 'HUMAN') {
      return null;
    }

    if (conversation.mode === 'AI' && company.aiConfig?.isActive) {
      try {
        const { AIService } = require('../ai/ai.service');
        const aiService = new AIService(this.prisma, this.httpService, this.configService);
        const result = await aiService.chat(conversation.id, messageContent, connection.companyId);
        botResponse = result.response;
      } catch (error) {
        this.logger.error(`AI chat failed: ${error.message}`);
        botResponse = 'Desculpe, estou com dificuldades no momento. Por favor, tente novamente.';
      }
    } else if (conversation.mode === 'FLOW') {
      const activeFlow = await this.prisma.flow.findFirst({
        where: {
          companyId: connection.companyId,
          isActive: true,
        },
      });

      if (activeFlow) {
        try {
          const { FlowsService } = require('../flows/flows.service');
          const flowsService = new FlowsService(this.prisma);
          const result = await flowsService.execute(conversation.id, messageContent, connection.companyId);
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

      await this.sendMessage(phone, botResponse, connection.companyId);
    }

    return botResponse;
  }

  async sendMessage(phone: string, message: string, companyId: string) {
    const connection = await this.prisma.whatsAppConnection.findFirst({
      where: { companyId },
    });

    if (!connection) {
      throw new InternalServerErrorException('Conexão WhatsApp não encontrada');
    }

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/message/sendText/${connection.instanceName}`,
          {
            number: phone,
            text: message,
          },
          { headers: this.headers },
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      throw new InternalServerErrorException('Falha ao enviar mensagem WhatsApp');
    }
  }
}
