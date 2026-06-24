import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AIService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { AIConfigDto, TestKeyDto, AI_MODELS } from './dto/ai-config.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('ai/chat')
  async chat(@Body() dto: ChatDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      select: { companyId: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    return this.aiService.chat(dto.conversationId, dto.message, conversation.companyId);
  }

  @Post('ai/test-key')
  async testKey(@Body() dto: TestKeyDto) {
    return this.aiService.testKey(dto);
  }

  @Get('ai/models')
  getModels() {
    return AI_MODELS;
  }

  @Get('companies/:companyId/ai-config')
  async getAIConfig(@Param('companyId') companyId: string) {
    return this.aiService.getAIConfig(companyId);
  }

  @Post('companies/:companyId/ai-config')
  async createOrUpdateAIConfig(
    @Param('companyId') companyId: string,
    @Body() dto: AIConfigDto,
  ) {
    return this.aiService.createOrUpdateAIConfig(companyId, dto);
  }
}
