import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async list(companyId: string, status?: string, mode?: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        companyId,
        ...(status && { status: status as any }),
        ...(mode && { mode: mode as any }),
      },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    return conversations.map(({ messages, ...conversation }) => ({
      ...conversation,
      lastMessage: messages[0]?.content,
      lastMessageTime: messages[0]?.createdAt,
    }));
  }

  async messages(companyId: string, conversationId: string) {
    await this.getConversation(companyId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(companyId: string, conversationId: string, content: string) {
    const conversation = await this.getConversation(companyId, conversationId);
    await this.whatsapp.sendMessage(
      conversation.clientJid || conversation.clientPhone,
      content,
      companyId,
    );
    
    if (conversation.mode !== 'HUMAN') {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { mode: 'HUMAN' },
      });
    }

    return this.prisma.message.create({
      data: { conversationId, content, direction: 'OUTBOUND', sender: 'HUMAN' },
    });
  }

  async update(companyId: string, id: string, data: { mode?: any; status?: any }) {
    await this.getConversation(companyId, id);
    return this.prisma.conversation.update({
      where: { id },
      data: {
        ...(data.mode && { mode: data.mode }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  private async getConversation(companyId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, companyId } });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }
}
