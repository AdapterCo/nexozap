import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AIConfigDto, AIProviderDto, TestKeyDto } from './dto/ai-config.dto';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAIConfig(companyId: string) {
    const config = await this.prisma.aIConfig.findFirst({
      where: { companyId },
    });

    if (!config) {
      throw new NotFoundException('Configuração de IA não encontrada');
    }

    return {
      ...config,
      apiKey: config.apiKey ? '••••••' + config.apiKey.slice(-4) : null,
    };
  }

  async createOrUpdateAIConfig(companyId: string, dto: AIConfigDto) {
    const existing = await this.prisma.aIConfig.findFirst({
      where: { companyId },
    });

    const data: any = {};
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.apiKey !== undefined && dto.apiKey !== '') data.apiKey = dto.apiKey;
    if (dto.personality !== undefined) data.personality = dto.personality;
    if (dto.toneOfVoice !== undefined) data.toneOfVoice = dto.toneOfVoice;
    if (dto.rules !== undefined) data.rules = dto.rules;
    if (dto.faq !== undefined) data.faq = dto.faq;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.dailyTokenLimit !== undefined) data.dailyTokenLimit = dto.dailyTokenLimit;
    if (dto.monthlyTokenLimit !== undefined) data.monthlyTokenLimit = dto.monthlyTokenLimit;
    if (dto.allowedHoursStart !== undefined) data.allowedHoursStart = dto.allowedHoursStart;
    if (dto.allowedHoursEnd !== undefined) data.allowedHoursEnd = dto.allowedHoursEnd;

    if (existing) {
      return this.prisma.aIConfig.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.aIConfig.create({
      data: {
        companyId,
        provider: dto.provider || 'OPENAI',
        model: dto.model || 'gpt-4o-mini',
        apiKey: dto.apiKey,
        personality: dto.personality,
        toneOfVoice: dto.toneOfVoice,
        rules: dto.rules || [],
        faq: dto.faq || [],
        isActive: dto.isActive ?? false,
        dailyTokenLimit: dto.dailyTokenLimit ?? 100000,
        monthlyTokenLimit: dto.monthlyTokenLimit ?? 2000000,
        allowedHoursStart: dto.allowedHoursStart ?? '08:00',
        allowedHoursEnd: dto.allowedHoursEnd ?? '22:00',
      },
    });
  }

  async checkTokenLimit(companyId: string): Promise<{ allowed: boolean; dailyUsed: number; monthlyUsed: number }> {
    const config = await this.prisma.aIConfig.findFirst({
      where: { companyId },
    });

    if (!config) {
      return { allowed: true, dailyUsed: 0, monthlyUsed: 0 };
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyUsage = await this.prisma.tokenUsage.aggregate({
      where: { companyId, date: { gte: todayStart } },
      _sum: { tokensUsed: true },
    });

    const monthlyUsage = await this.prisma.tokenUsage.aggregate({
      where: { companyId, date: { gte: monthStart } },
      _sum: { tokensUsed: true },
    });

    const dailyUsed = dailyUsage._sum.tokensUsed || 0;
    const monthlyUsed = monthlyUsage._sum.tokensUsed || 0;

    const allowed = dailyUsed < config.dailyTokenLimit && monthlyUsed < config.monthlyTokenLimit;

    return { allowed, dailyUsed, monthlyUsed };
  }

  async testKey(dto: TestKeyDto): Promise<{ valid: boolean; provider: string; model?: string; error?: string }> {
    try {
      switch (dto.provider) {
        case AIProviderDto.OPENAI:
          return await this.testOpenAIKey(dto.apiKey);
        case AIProviderDto.GROQ:
          return await this.testGroqKey(dto.apiKey);
        case AIProviderDto.GEMINI:
          return await this.testGeminiKey(dto.apiKey);
        default:
          return { valid: false, provider: dto.provider, error: 'Provedor desconhecido' };
      }
    } catch (error) {
      return {
        valid: false,
        provider: dto.provider,
        error: error.message || 'Erro ao validar chave',
      };
    }
  }

  private async testOpenAIKey(apiKey: string): Promise<{ valid: boolean; provider: string; model?: string; error?: string }> {
    const response = await firstValueFrom(
      this.httpService.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );

    if (response.data?.data?.length > 0) {
      return {
        valid: true,
        provider: 'OPENAI',
        model: response.data.data[0]?.id,
      };
    }

    return { valid: false, provider: 'OPENAI', error: 'Nenhum modelo encontrado' };
  }

  private async testGroqKey(apiKey: string): Promise<{ valid: boolean; provider: string; model?: string; error?: string }> {
    const response = await firstValueFrom(
      this.httpService.get('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );

    if (response.data?.data?.length > 0) {
      return {
        valid: true,
        provider: 'GROQ',
        model: response.data.data[0]?.id,
      };
    }

    return { valid: false, provider: 'GROQ', error: 'Nenhum modelo encontrado' };
  }

  private async testGeminiKey(apiKey: string): Promise<{ valid: boolean; provider: string; model?: string; error?: string }> {
    const response = await firstValueFrom(
      this.httpService.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`),
    );

    if (response.data?.models?.length > 0) {
      return {
        valid: true,
        provider: 'GEMINI',
        model: response.data.models[0]?.name?.replace('models/', ''),
      };
    }

    return { valid: false, provider: 'GEMINI', error: 'Nenhum modelo encontrado' };
  }

  async chat(conversationId: string, message: string, companyId: string) {
    const tokenCheck = await this.checkTokenLimit(companyId);
    if (!tokenCheck.allowed) {
      throw new BadRequestException(
        `Limite de tokens atingido. Diário: ${tokenCheck.dailyUsed}, Mensal: ${tokenCheck.monthlyUsed}`,
      );
    }

    const [config, company, services, professionals] = await Promise.all([
      this.prisma.aIConfig.findFirst({ where: { companyId } }),
      this.prisma.company.findUnique({ where: { id: companyId } }),
      this.prisma.service.findMany({ where: { companyId, isActive: true } }),
      this.prisma.professional.findMany({ where: { companyId, isActive: true } }),
    ]);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const systemPrompt = this.buildSystemPrompt(config, company, services, professionals);
    const provider = (config?.provider as AIProviderDto) || AIProviderDto.OPENAI;
    const model = config?.model || this.getDefaultModel(provider);
    const apiKey = config?.apiKey;

    if (!apiKey) {
      throw new BadRequestException(
        `Chave de API do ${provider} não configurada. Configure uma chave válida nas configurações de IA.`,
      );
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.slice(-20).map((m) => ({
        role: m.sender === 'CLIENT' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const tools = this.getTools();

    let totalTokens = 0;
    let responseText = '';

    try {
      switch (provider) {
        case AIProviderDto.OPENAI:
          ({ responseText, totalTokens } = await this.callOpenAI(apiKey, model, messages, tools, companyId));
          break;
        case AIProviderDto.GROQ:
          ({ responseText, totalTokens } = await this.callGroq(apiKey, model, messages, tools, companyId));
          break;
        case AIProviderDto.GEMINI:
          ({ responseText, totalTokens } = await this.callGemini(apiKey, model, messages, tools, companyId));
          break;
      }
    } catch (error) {
      this.logger.error(`AI Provider ${provider} error: ${error.message}`);
      throw new BadRequestException(`Erro ao processar mensagem com IA (${provider})`);
    }

    if (totalTokens > 0) {
      const costPerToken = this.getCostPerToken(provider, model);
      const cost = totalTokens * costPerToken;

      await this.prisma.tokenUsage.create({
        data: { companyId, tokensUsed: totalTokens, cost },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { tokenUsage: { increment: totalTokens } },
      });
    }

    return { response: responseText, tokensUsed: totalTokens, provider, model };
  }

  private getDefaultModel(provider: AIProviderDto): string {
    const defaults: Record<AIProviderDto, string> = {
      [AIProviderDto.OPENAI]: 'gpt-4o-mini',
      [AIProviderDto.GROQ]: 'llama-3.1-8b-instant',
      [AIProviderDto.GEMINI]: 'gemini-2.5-flash',
    };
    return defaults[provider];
  }

  private getCostPerToken(provider: AIProviderDto, model: string): number {
    const costs: Record<string, number> = {
      'gpt-4o-mini': 0.00000015,
      'gpt-4o': 0.000005,
      'gpt-4-turbo': 0.00001,
      'gpt-3.5-turbo': 0.0000005,
      'llama-3.1-8b-instant': 0.00000005,
      'llama-3.1-70b-versatile': 0.00000059,
      'llama3-70b-8192': 0.00000059,
      'llama3-8b-8192': 0.00000005,
      'mixtral-8x7b-32768': 0.00000024,
      'gemma2-9b-it': 0.0000002,
      'gemini-2.5-flash': 0.00000015,
      'gemini-1.5-flash': 0.000000075,
      'gemini-1.5-pro': 0.00000125,
      'gemini-1.0-pro': 0.0000005,
    };
    return costs[model] || 0.000001;
  }

  private getTools() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'getAvailableSlots',
          description: 'Obtém horários disponíveis para um profissional em uma data específica',
          parameters: {
            type: 'object',
            properties: {
              professionalId: { type: 'string', description: 'ID do profissional' },
              date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
            },
            required: ['professionalId', 'date'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'createAppointment',
          description: 'Cria um novo agendamento',
          parameters: {
            type: 'object',
            properties: {
              serviceId: { type: 'string', description: 'ID do serviço' },
              professionalId: { type: 'string', description: 'ID do profissional' },
              clientName: { type: 'string', description: 'Nome do cliente' },
              clientPhone: { type: 'string', description: 'Telefone do cliente' },
              date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
              time: { type: 'string', description: 'Horário no formato HH:MM' },
            },
            required: ['serviceId', 'professionalId', 'clientName', 'clientPhone', 'date', 'time'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'cancelAppointment',
          description: 'Cancela um agendamento existente',
          parameters: {
            type: 'object',
            properties: {
              appointmentId: { type: 'string', description: 'ID do agendamento' },
            },
            required: ['appointmentId'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'getServices',
          description: 'Lista todos os serviços disponíveis',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'getProfessionals',
          description: 'Lista todos os profissionais disponíveis',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
  }

  private async callOpenAI(
    apiKey: string,
    model: string,
    messages: any[],
    tools: any[],
    companyId: string,
  ): Promise<{ responseText: string; totalTokens: number }> {
    let totalTokens = 0;

    const response = await firstValueFrom(
      this.httpService.post(
        'https://api.openai.com/v1/chat/completions',
        { model, messages, tools, tool_choice: 'auto', max_tokens: 1000 },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
      ),
    );

    const choice = response.data.choices[0];
    totalTokens = response.data.usage?.total_tokens || 0;

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        const toolResult = await this.executeTool(fnName, fnArgs, companyId);

        messages.push(choice.message);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      const followUp = await firstValueFrom(
        this.httpService.post(
          'https://api.openai.com/v1/chat/completions',
          { model, messages, max_tokens: 1000 },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );

      totalTokens += followUp.data.usage?.total_tokens || 0;
      return { responseText: followUp.data.choices[0].message.content, totalTokens };
    }

    return { responseText: choice.message.content, totalTokens };
  }

  private async callGroq(
    apiKey: string,
    model: string,
    messages: any[],
    tools: any[],
    companyId: string,
  ): Promise<{ responseText: string; totalTokens: number }> {
    let totalTokens = 0;

    const response = await firstValueFrom(
      this.httpService.post(
        'https://api.groq.com/openai/v1/chat/completions',
        { model, messages, tools, tool_choice: 'auto', max_tokens: 1000 },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
      ),
    );

    const choice = response.data.choices[0];
    totalTokens = response.data.usage?.total_tokens || 0;

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        const toolResult = await this.executeTool(fnName, fnArgs, companyId);

        messages.push(choice.message);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      const followUp = await firstValueFrom(
        this.httpService.post(
          'https://api.groq.com/openai/v1/chat/completions',
          { model, messages, max_tokens: 1000 },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );

      totalTokens += followUp.data.usage?.total_tokens || 0;
      return { responseText: followUp.data.choices[0].message.content, totalTokens };
    }

    return { responseText: choice.message.content, totalTokens };
  }

  private async callGemini(
    apiKey: string,
    model: string,
    messages: any[],
    tools: any[],
    companyId: string,
  ): Promise<{ responseText: string; totalTokens: number }> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const contents = conversationMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || '' }],
    }));

    const functionDeclarations = tools
      .filter((t) => t.type === 'function')
      .map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }));

    const requestBody: any = {
      contents,
      systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      generationConfig: { maxOutputTokens: 1000 },
      tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
    };

    const response = await firstValueFrom(
      this.httpService.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        requestBody,
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const candidate = response.data.candidates?.[0];
    const totalTokens = response.data.usageMetadata?.totalTokenCount || 0;

    if (!candidate?.content?.parts) {
      return { responseText: 'Desculpe, não consegui processar sua mensagem.', totalTokens };
    }

    const functionCalls = candidate.content.parts.filter((p: any) => p.functionCall);

    if (functionCalls.length > 0) {
      const functionResponses: any[] = [];

      for (const fc of functionCalls) {
        const fnName = fc.functionCall.name;
        const fnArgs = fc.functionCall.args || {};
        const toolResult = await this.executeTool(fnName, fnArgs, companyId);
        functionResponses.push({
          functionResponse: { name: fnName, response: toolResult },
        });
      }

      contents.push({ role: 'model', parts: candidate.content.parts });
      contents.push({ role: 'user', parts: functionResponses });

      const followUpResponse = await firstValueFrom(
        this.httpService.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            contents,
            systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
            generationConfig: { maxOutputTokens: 1000 },
          },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const followUpCandidate = followUpResponse.data.candidates?.[0];
      const followUpText = followUpCandidate?.content?.parts?.find((p: any) => p.text)?.text || '';
      const followUpTokens = followUpResponse.data.usageMetadata?.totalTokenCount || 0;

      return { responseText: followUpText, totalTokens: totalTokens + followUpTokens };
    }

    const textPart = candidate.content.parts.find((p: any) => p.text);
    return { responseText: textPart?.text || '', totalTokens };
  }

  private async executeTool(fnName: string, fnArgs: any, companyId: string): Promise<any> {
    const services = await this.prisma.service.findMany({ where: { companyId, isActive: true } });
    const professionals = await this.prisma.professional.findMany({ where: { companyId, isActive: true } });

    switch (fnName) {
      case 'getAvailableSlots':
        return this.getAvailableSlots(fnArgs.professionalId, fnArgs.date, companyId);
      case 'createAppointment':
        return this.createAppointment(companyId, fnArgs, '');
      case 'cancelAppointment':
        return this.cancelAppointment(fnArgs.appointmentId, companyId);
      case 'getServices':
        return services.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.durationMinutes,
        }));
      case 'getProfessionals':
        return professionals.map((p) => ({
          id: p.id,
          name: p.name,
          specialty: p.specialty,
        }));
      default:
        return { error: 'Função desconhecida' };
    }
  }

  private async getAvailableSlots(professionalId: string, dateStr: string, companyId: string) {
    const date = new Date(dateStr);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });

    if (!professional || !company) {
      return { slots: [], error: 'Profissional ou empresa não encontrado' };
    }

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[date.getDay()];

    if (!professional.availableDays.includes(dayName)) {
      return { slots: [], message: 'Profissional não disponível neste dia' };
    }

    const [openH, openM] = company.openingTime.split(':').map(Number);
    const [closeH, closeM] = company.closingTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
      },
    });

    const timeBlocks = await this.prisma.timeBlock.findMany({
      where: { professionalId, date: { gte: dayStart, lte: dayEnd } },
    });

    const occupiedSlots = new Set<string>();
    existingAppointments.forEach((a) => occupiedSlots.add(`${a.startTime}-${a.endTime}`));
    timeBlocks.forEach((t) => occupiedSlots.add(`${t.startTime}-${t.endTime}`));

    const slots: string[] = [];
    for (let m = openMinutes; m < closeMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const slotTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const endSlot = m + 30;
      const slotEnd = `${String(Math.floor(endSlot / 60)).padStart(2, '0')}:${String(endSlot % 60).padStart(2, '0')}`;

      let isOccupied = false;
      for (const occupied of occupiedSlots) {
        const [occStart, occEnd] = occupied.split('-');
        if (slotTime < occEnd && slotEnd > occStart) {
          isOccupied = true;
          break;
        }
      }

      if (!isOccupied) slots.push(slotTime);
    }

    return { slots, date: dateStr, professionalId };
  }

  private async createAppointment(
    companyId: string,
    data: { serviceId: string; professionalId: string; clientName: string; clientPhone: string; date: string; time: string },
    defaultPhone: string,
  ) {
    const service = await this.prisma.service.findFirst({ where: { id: data.serviceId, companyId } });
    if (!service) return { error: 'Serviço não encontrado' };

    const professional = await this.prisma.professional.findFirst({ where: { id: data.professionalId, companyId } });
    if (!professional) return { error: 'Profissional não encontrado' };

    const [startH, startM] = data.time.split(':').map(Number);
    const totalMinutes = startH * 60 + startM + service.durationMinutes;
    const endTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

    const appointment = await this.prisma.appointment.create({
      data: {
        companyId,
        serviceId: data.serviceId,
        professionalId: data.professionalId,
        clientName: data.clientName,
        clientPhone: data.clientPhone || defaultPhone,
        date: new Date(data.date),
        startTime: data.time,
        endTime,
      },
      include: { service: true, professional: true },
    });

    return {
      success: true,
      appointment: {
        id: appointment.id,
        service: appointment.service.name,
        professional: appointment.professional.name,
        date: data.date,
        time: data.time,
        endTime,
      },
    };
  }

  private async cancelAppointment(appointmentId: string, companyId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, companyId },
    });

    if (!appointment) return { error: 'Agendamento não encontrado' };

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    return { success: true, message: 'Agendamento cancelado com sucesso' };
  }

  buildSystemPrompt(config: any, company: any, services: any[], professionals: any[]) {
    const servicesList = services
      .map((s) => `- ${s.name}: R$ ${s.price.toFixed(2)}, ${s.durationMinutes} minutos`)
      .join('\n');

    const professionalsList = professionals
      .map((p) => `- ${p.name}${p.specialty ? ` (${p.specialty})` : ''}`)
      .join('\n');

    const rules = config?.rules?.length
      ? (config.rules as string[]).map((r) => `- ${r}`).join('\n')
      : '';

    const faq = config?.faq?.length
      ? (config.faq as any[]).map((f) => `P: ${f.question}\nR: ${f.answer}`).join('\n')
      : '';

    const personality = config?.personality || 'Atencioso, profissional e prestativo';
    const toneOfVoice = config?.toneOfVoice || 'Formal e cordial';

    return `Você é um assistente virtual da empresa "${company?.name || 'Empresa'}".
Horário de funcionamento: ${company?.openingTime || '08:00'} às ${company?.closingTime || '18:00'}.

Personalidade: ${personality}
Tom de voz: ${toneOfVoice}

Serviços disponíveis:
${servicesList || 'Nenhum serviço cadastrado'}

Profissionais disponíveis:
${professionalsList || 'Nenhum profissional cadastrado'}

${rules ? `Regras:\n${rules}` : ''}

${faq ? `Perguntas Frequentes:\n${faq}` : ''}

Diretrizes:
- Seja breve e direto nas respostas (WhatsApp)
- Ao agendar, confirme os dados com o cliente antes de criar o agendamento
- Sempre cumprimente adequadamente
- Se o cliente quiser cancelar, confirme antes de executar
- Disponível apenas durante o horário de funcionamento
- Não invente informações sobre serviços ou profissionais`;
  }
}
