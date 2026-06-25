import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
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
  async chat(@Body() dto: ChatDto, @Request() request: any) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      select: { companyId: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const membership = await this.prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: conversation.companyId, userId: request.user.id } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Você não possui acesso a esta conversa');

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
  @UseGuards(CompanyAccessGuard)
  async getAIConfig(@Param('companyId') companyId: string) {
    return this.aiService.getAIConfig(companyId);
  }

  @Post('companies/:companyId/ai-config')
  @UseGuards(CompanyAccessGuard)
  async createOrUpdateAIConfig(
    @Param('companyId') companyId: string,
    @Body() dto: AIConfigDto,
  ) {
    return this.aiService.createOrUpdateAIConfig(companyId, dto);
  }

  @Get('companies/:companyId/ai-usage')
  @UseGuards(CompanyAccessGuard)
  getUsage(@Param('companyId') companyId: string) {
    return this.aiService.getUsageHistory(companyId);
  }
}
