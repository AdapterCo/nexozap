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
import { EncryptionService } from '../common/security/encryption.service';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  /** Tools que o fallback de parsing de texto do Groq/LLaMA pode executar sem contrato de tool_call estruturado */
  private static readonly SAFE_TEXT_FALLBACK_TOOLS = new Set(['getAvailableSlots', 'getServices', 'getProfessionals', 'getClientAppointments']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  private get http(): HttpService {
    return this.httpService;
  }

  async getAIConfig(companyId: string) {
    const config = await this.prisma.aIConfig.findFirst({
      where: { companyId },
    });

    if (!config) {
      throw new NotFoundException('Configuração de IA não encontrada');
    }

    return {
      ...config,
      apiKey: config.apiKey ? this.maskApiKey(config.apiKey) : null,
    };
  }

  async createOrUpdateAIConfig(companyId: string, dto: AIConfigDto) {
    const existing = await this.prisma.aIConfig.findFirst({
      where: { companyId },
    });

    const data: any = {};
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.apiKey !== undefined) {
      if (dto.apiKey === '') {
        data.apiKey = null;
      } else if (!this.isMaskedApiKey(dto.apiKey)) {
        data.apiKey = this.encryption.encrypt(dto.apiKey);
      }
    }
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
      const updated = await this.prisma.aIConfig.update({
        where: { id: existing.id },
        data,
      });
      return {
        ...updated,
        apiKey: updated.apiKey ? this.maskApiKey(updated.apiKey) : null,
      };
    }

    const created = await this.prisma.aIConfig.create({
      data: {
        companyId,
        provider: dto.provider || 'OPENAI',
        model: dto.model || 'gpt-4o-mini',
        apiKey: dto.apiKey && !this.isMaskedApiKey(dto.apiKey) ? this.encryption.encrypt(dto.apiKey) : undefined,
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

    return {
      ...created,
      apiKey: created.apiKey ? this.maskApiKey(created.apiKey) : null,
    };
  }

  private maskApiKey(value: string) {
    try {
      const decrypted = this.encryption.decrypt(value);
      return `••••••${decrypted.slice(-4)}`;
    } catch {
      return '••••••';
    }
  }

  private isMaskedApiKey(value: string) {
    return value.trim().startsWith('••••••');
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

  async getUsageHistory(companyId: string) {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const usage = await this.prisma.tokenUsage.findMany({
      where: { companyId, date: { gte: start } },
      orderBy: { date: 'asc' },
    });
    const days = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.set(day.toISOString().slice(0, 10), 0);
    }
    usage.forEach((item) => {
      const key = item.date.toISOString().slice(0, 10);
      days.set(key, (days.get(key) ?? 0) + item.tokensUsed);
    });
    return {
      chart: [...days].map(([date, tokens]) => ({ date, tokens })),
      summary: {
        totalMonth: usage.reduce((sum, item) => sum + item.tokensUsed, 0),
        estimatedCost: usage.reduce((sum, item) => sum + item.cost, 0),
      },
    };
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
      this.http.get('https://api.openai.com/v1/models', {
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
      this.http.get('https://api.groq.com/openai/v1/models', {
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
      this.http.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`),
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

    if (!config) {
      throw new BadRequestException('Configuracao de IA nao encontrada para esta empresa.');
    }

    if (company?.plan === 'BASIC') {
      throw new BadRequestException('O plano Básico não inclui o assistente de IA. Faça upgrade para o plano Profissional ou Empresarial.');
    }

    if (company?.planStatus === 'PAST_DUE') {
      throw new BadRequestException('Assinatura vencida. Regularize o plano para continuar usando o assistente de IA.');
    }

    if (!config.isActive) {
      throw new BadRequestException('Assistente de IA desativado para esta empresa.');
    }

    const { currentTime } = this.getBrazilDatetime();
    if (this.isOutsideAllowedHours(config, currentTime)) {
      throw new BadRequestException('Fora do horário de atendimento configurado para o assistente de IA.');
    }

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
    const apiKey = config?.apiKey ? this.encryption.decrypt(config.apiKey) : null;

    if (!apiKey) {
      throw new BadRequestException(
        `Chave de API do ${provider} não configurada. Configure uma chave válida nas configurações de IA.`,
      );
    }

    // A mensagem atual pode já ter sido persistida pelo chamador (ex: WhatsAppService) antes
    // de chegar aqui — se o último item do histórico for exatamente ela, não a duplicamos.
    let history = this.selectRecentHistory(conversation.messages);
    const lastHistoryItem = history[history.length - 1];
    if (lastHistoryItem && lastHistoryItem.sender === 'CLIENT' && lastHistoryItem.content === message) {
      history = history.slice(0, -1);
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
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
      this.logger.error(
        `AI Provider ${provider} (${model}) error: ${this.getProviderErrorMessage(error)}`,
      );
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

  private getProviderErrorMessage(error: unknown): string {
    const err = error as any;
    const responseData = err?.response?.data;

    if (responseData) {
      if (typeof responseData === 'string') return responseData;
      try {
        return JSON.stringify(responseData);
      } catch {
        return String(responseData);
      }
    }

    return err?.message || 'Erro desconhecido';
  }

  private getDefaultModel(provider: AIProviderDto): string {
    const defaults: Record<AIProviderDto, string> = {
      [AIProviderDto.OPENAI]: 'gpt-4o-mini',
      // llama-3.3-70b-versatile tem suporte nativo a tool calling no Groq
      [AIProviderDto.GROQ]: 'llama-3.3-70b-versatile',
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
      'llama-3.3-70b-versatile': 0.00000059,
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
          name: 'getClientAppointments',
          description: 'Lista os agendamentos futuros (não cancelados nem concluídos) de um cliente pelo telefone. Use antes de cancelAppointment para descobrir o appointmentId correto.',
          parameters: {
            type: 'object',
            properties: {
              clientPhone: { type: 'string', description: 'Telefone do cliente' },
            },
            required: ['clientPhone'],
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
      this.http.post(
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
        this.http.post(
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
      this.http.post(
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
        this.http.post(
          'https://api.groq.com/openai/v1/chat/completions',
          { model, messages, max_tokens: 1000 },
          { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
        ),
      );

      totalTokens += followUp.data.usage?.total_tokens || 0;
      return { responseText: followUp.data.choices[0].message.content, totalTokens };
    }

    // Fallback: LLaMA às vezes retorna <function=name>{...} no content em vez de tool_calls
    if (choice.message.content) {
      const llamaCall = this.parseGroqLlamaToolCall(choice.message.content);
      if (llamaCall) {
        if (!AIService.SAFE_TEXT_FALLBACK_TOOLS.has(llamaCall.fnName)) {
          // Ações com efeito colateral real (criar/cancelar agendamento) exigem o contrato
          // estruturado de tool_calls da API — não são executadas a partir de um parse de
          // texto livre, que pode ser uma alucinação de formatação do modelo.
          this.logger.warn(`Groq LLaMA tentou executar '${llamaCall.fnName}' via fallback de texto; ignorado por segurança.`);
          return {
            responseText: llamaCall.textBefore || 'Só um instante, pode confirmar os dados novamente?',
            totalTokens,
          };
        }

        this.logger.log(`Groq LLaMA tool call detectado no content: ${llamaCall.fnName}`);
        const toolResult = await this.executeTool(llamaCall.fnName, llamaCall.fnArgs, companyId);
        const fakeId = `call_${Date.now()}`;
        messages.push({
          role: 'assistant',
          content: llamaCall.textBefore || null,
          tool_calls: [{
            id: fakeId,
            type: 'function',
            function: { name: llamaCall.fnName, arguments: JSON.stringify(llamaCall.fnArgs) },
          }],
        });
        messages.push({ role: 'tool', tool_call_id: fakeId, content: JSON.stringify(toolResult) });

        const followUp = await firstValueFrom(
          this.http.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { model, messages, max_tokens: 1000 },
            { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
          ),
        );

        totalTokens += followUp.data.usage?.total_tokens || 0;
        return { responseText: followUp.data.choices[0].message.content, totalTokens };
      }
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
      this.http.post(
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
        this.http.post(
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

  /**
   * Resolve um nome informado pelo modelo para um ID único, quando ele não usa o UUID interno.
   * Se houver mais de um resultado (ex: dois profissionais com nomes parecidos), retorna erro
   * pedindo confirmação em vez de escolher um arbitrariamente.
   */
  private async resolveIdByName(
    model: 'professional' | 'service',
    companyId: string,
    value: string,
  ): Promise<{ id?: string; error?: string }> {
    const label = model === 'professional' ? 'profissional' : 'serviço';
    const matches = model === 'professional'
      ? await this.prisma.professional.findMany({
          where: { companyId, name: { contains: value, mode: 'insensitive' }, isActive: true },
          select: { id: true, name: true },
        })
      : await this.prisma.service.findMany({
          where: { companyId, name: { contains: value, mode: 'insensitive' }, isActive: true },
          select: { id: true, name: true },
        });

    if (matches.length === 0) {
      return { error: `Nenhum ${label} encontrado com o nome "${value}".` };
    }
    if (matches.length > 1) {
      return { error: `Mais de um ${label} corresponde a "${value}" (${matches.map((m) => m.name).join(', ')}). Peça ao cliente para confirmar qual deles.` };
    }
    return { id: matches[0].id };
  }

  private async executeTool(fnName: string, fnArgs: any, companyId: string): Promise<any> {
    switch (fnName) {
      case 'getAvailableSlots': {
        // Modelo pode enviar nome em vez de UUID — resolver por nome se necessário
        let professionalId = fnArgs.professionalId as string;
        if (professionalId && !this.isUUID(professionalId)) {
          const resolved = await this.resolveIdByName('professional', companyId, professionalId);
          if (resolved.error) return { error: resolved.error };
          professionalId = resolved.id!;
        }
        return this.getAvailableSlots(professionalId, fnArgs.date, companyId);
      }
      case 'createAppointment': {
        const args = { ...fnArgs };
        // Resolver serviceId por nome se não for UUID
        if (args.serviceId && !this.isUUID(args.serviceId)) {
          const resolved = await this.resolveIdByName('service', companyId, args.serviceId);
          if (resolved.error) return { error: resolved.error };
          args.serviceId = resolved.id;
        }
        // Resolver professionalId por nome se não for UUID
        if (args.professionalId && !this.isUUID(args.professionalId)) {
          const resolved = await this.resolveIdByName('professional', companyId, args.professionalId);
          if (resolved.error) return { error: resolved.error };
          args.professionalId = resolved.id;
        }
        return this.createAppointment(companyId, args, '');
      }
      case 'cancelAppointment':
        return this.cancelAppointment(fnArgs.appointmentId, companyId);
      case 'getClientAppointments':
        return this.getClientAppointments(companyId, fnArgs.clientPhone);
      case 'getServices': {
        const services = await this.prisma.service.findMany({ where: { companyId, isActive: true } });
        return services.map((s) => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.durationMinutes,
        }));
      }
      case 'getProfessionals': {
        const professionals = await this.prisma.professional.findMany({ where: { companyId, isActive: true } });
        return professionals.map((p) => ({
          id: p.id,
          name: p.name,
          specialty: p.specialty,
        }));
      }
      default:
        return { error: 'Função desconhecida' };
    }
  }

  private parseDateString(dateStr: any): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const clean = dateStr.trim();

    // Formato DD/MM/AAAA ou DD-MM-AAAA
    const brMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (brMatch) {
      const d = Number(brMatch[1]);
      const m = Number(brMatch[2]);
      const y = Number(brMatch[3]);
      // Rejeitar valores fora dos limites antes de construir a data
      if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2020 || y > 2100) return null;
      const date = new Date(y, m - 1, d);
      // Verificar overflow: JS converte 30/02 para 02/03 silenciosamente
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
      return date;
    }

    // Formato AAAA-MM-DD ou AAAA/MM/DD
    const isoMatch = clean.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]);
      const d = Number(isoMatch[3]);
      if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2020 || y > 2100) return null;
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
      return date;
    }

    // Sem fallback genérico — rejeitar formatos desconhecidos para evitar datas acidentais
    return null;
  }

  /** Verifica se o horário atual está fora da janela de atendimento configurada (comparação simples HH:MM, sem virada de dia) */
  private isOutsideAllowedHours(config: { allowedHoursStart?: string | null; allowedHoursEnd?: string | null }, currentTime: string): boolean {
    if (!config.allowedHoursStart || !config.allowedHoursEnd) return false;
    return currentTime < config.allowedHoursStart || currentTime >= config.allowedHoursEnd;
  }

  /**
   * Seleciona as mensagens mais recentes do histórico respeitando um orçamento aproximado
   * de caracteres (proxy simples de tokens), em vez de um número fixo de mensagens — evita
   * tanto estourar o contexto do modelo quanto perder informação relevante prematuramente.
   */
  private selectRecentHistory<T extends { content: string }>(messages: T[], maxChars = 8000, maxMessages = 40): T[] {
    const result: T[] = [];
    let totalChars = 0;
    for (let i = messages.length - 1; i >= 0 && result.length < maxMessages; i--) {
      const len = messages[i].content?.length || 0;
      if (totalChars + len > maxChars && result.length > 0) break;
      totalChars += len;
      result.unshift(messages[i]);
    }
    return result;
  }

  /** Retorna data e hora atual no fuso horário de Brasília (America/Sao_Paulo) */
  private getBrazilDatetime(): { today: string; todayISO: string; currentTime: string } {
    const now = new Date();
    const tz = 'America/Sao_Paulo';
    const today = now.toLocaleDateString('pt-BR', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // en-CA formata como YYYY-MM-DD
    const todayISO = now.toLocaleDateString('en-CA', { timeZone: tz });
    const currentTime = now.toLocaleTimeString('pt-BR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });
    return { today, todayISO, currentTime };
  }

  /** Detecta chamadas no formato LLaMA: <function=nome>{...} no content do Groq */
  private parseGroqLlamaToolCall(content: string): { fnName: string; fnArgs: any; textBefore: string } | null {
    const match = content.match(/^([\s\S]*?)<function=(\w+)>([\s\S]*?)(?:<\/function>)?$/);
    if (!match) return null;
    try {
      return {
        textBefore: match[1].trim(),
        fnName: match[2],
        fnArgs: JSON.parse(match[3].trim()),
      };
    } catch {
      return null;
    }
  }

  /** Verifica se um valor é um UUID v4 válido */
  private isUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private async getAvailableSlots(professionalId: string, dateStr: string, companyId: string) {
    if (!professionalId) {
      return { error: 'O ID do profissional é obrigatório.' };
    }
    const parsedDate = this.parseDateString(dateStr);
    if (!parsedDate) {
      return { error: 'Formato de data inválido. Por favor, forneça uma data válida (ex: AAAA-MM-DD ou DD/MM/AAAA).' };
    }
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth();
    const day = parsedDate.getDate();

    const date = new Date(year, month, day);
    const dayStart = new Date(year, month, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month, day, 23, 59, 59, 999);

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

    return { slots, date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, professionalId };
  }

  private async createAppointment(
    companyId: string,
    data: { serviceId: string; professionalId: string; clientName: string; clientPhone: string; date: string; time: string },
    defaultPhone: string,
  ) {
    if (!data.serviceId || !data.professionalId || !data.clientName || !data.date || !data.time) {
      return { error: 'Parâmetros obrigatórios ausentes. Por favor, forneça profissional, serviço, nome do cliente, data e horário.' };
    }

    const service = await this.prisma.service.findFirst({ where: { id: data.serviceId, companyId } });
    if (!service) return { error: 'Serviço não encontrado' };

    const professional = await this.prisma.professional.findFirst({ where: { id: data.professionalId, companyId } });
    if (!professional) return { error: 'Profissional não encontrado' };

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { error: 'Empresa não encontrada' };

    const parsedDate = this.parseDateString(data.date);
    if (!parsedDate) {
      return { error: 'Formato de data inválido. Por favor, use o formato AAAA-MM-DD ou DD/MM/AAAA.' };
    }
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth();
    const day = parsedDate.getDate();

    // UTC midnight para garantir consistência com o frontend (evita deslocamento de fuso)
    const appointmentDate = new Date(Date.UTC(year, month, day));

    // Validar disponibilidade do profissional no dia
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[appointmentDate.getUTCDay()];
    if (!professional.availableDays.includes(dayName)) {
      return { error: `Profissional não disponível neste dia da semana (${dayName})` };
    }

    // Validar horário de expediente
    if (data.time < company.openingTime || data.time >= company.closingTime) {
      return { error: `Horário fora do expediente da empresa (${company.openingTime} - ${company.closingTime})` };
    }

    const timeMatch = data.time.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return { error: 'Formato de horário inválido. Use o formato HH:MM.' };
    }

    const [startH, startM] = data.time.split(':').map(Number);
    const totalMinutes = startH * 60 + startM + service.durationMinutes;
    const endTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

    if (endTime > company.closingTime) {
      return { error: `Agendamento ultrapassa o horário de encerramento (${company.closingTime})` };
    }

    // Verificar conflitos com outros agendamentos
    const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: data.professionalId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: data.time } }],
      },
    });
    if (overlapping) {
      return { error: `Conflito de horário: já existe agendamento das ${overlapping.startTime} às ${overlapping.endTime}` };
    }

    // Verificar bloqueios de horário
    const timeBlock = await this.prisma.timeBlock.findFirst({
      where: {
        professionalId: data.professionalId,
        date: { gte: dayStart, lte: dayEnd },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: data.time } }],
      },
    });
    if (timeBlock) {
      return { error: `Horário bloqueado${timeBlock.reason ? ': ' + timeBlock.reason : ''}` };
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        companyId,
        serviceId: data.serviceId,
        professionalId: data.professionalId,
        clientName: data.clientName,
        clientPhone: data.clientPhone || defaultPhone,
        date: appointmentDate,
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
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        time: data.time,
        endTime,
      },
    };
  }

  private async getClientAppointments(companyId: string, clientPhone: string) {
    if (!clientPhone) {
      return { error: 'O telefone do cliente é obrigatório.' };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        clientPhone,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        date: { gte: todayStart },
      },
      include: { service: true, professional: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return appointments.map((a) => ({
      appointmentId: a.id,
      service: a.service.name,
      professional: a.professional.name,
      date: a.date.toISOString().slice(0, 10),
      time: a.startTime,
      status: a.status,
    }));
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
    // IDs ficam no system prompt apenas como referência interna para uso nas tools
    // A IA recebe instruções explícitas para NUNCA mostrá-los ao cliente
    const servicesList = services
      .map((s) => `- ${s.name} [ID_INTERNO:${s.id}]: R$ ${s.price.toFixed(2)}, ${s.durationMinutes} minutos`)
      .join('\n');

    const professionalsList = professionals
      .map((p) => `- ${p.name} [ID_INTERNO:${p.id}]${p.specialty ? ` (${p.specialty})` : ''}`)
      .join('\n');

    const rules = config?.rules?.length
      ? (config.rules as string[]).map((r) => `- ${r}`).join('\n')
      : '';

    const faq = config?.faq?.length
      ? (config.faq as any[]).map((f) => `P: ${f.question}\nR: ${f.answer}`).join('\n')
      : '';

    const personality = config?.personality || 'Atencioso, profissional e prestativo';
    const toneOfVoice = config?.toneOfVoice || 'Formal e cordial';

    // Data e hora no fuso horário do Brasil (America/Sao_Paulo)
    const { today, todayISO, currentTime } = this.getBrazilDatetime();

    return `Você é um assistente virtual da empresa "${company?.name || 'Empresa'}".
Horário de funcionamento: ${company?.openingTime || '08:00'} às ${company?.closingTime || '18:00'}.
Data atual (horário de Brasília): ${today} — ${currentTime} — data ISO: ${todayISO}.

Personalidade: ${personality}
Tom de voz: ${toneOfVoice}

Serviços disponíveis (use o ID_INTERNO apenas nas chamadas de ferramentas, NUNCA mostre-o ao cliente):
${servicesList || 'Nenhum serviço cadastrado'}

Profissionais disponíveis (use o ID_INTERNO apenas nas chamadas de ferramentas, NUNCA mostre-o ao cliente):
${professionalsList || 'Nenhum profissional cadastrado'}

${rules ? `Regras:\n${rules}` : ''}

${faq ? `Perguntas Frequentes:\n${faq}` : ''}

Diretrizes OBRIGATÓRIAS:
- NUNCA exiba IDs (ID_INTERNO, UUIDs ou códigos técnicos) nas mensagens para o cliente
- Ao mencionar serviços ou profissionais, use apenas o nome (ex: "Barba", "Daniel")
- Seja breve e direto nas respostas (WhatsApp)
- Ao agendar, confirme os dados com o cliente antes de criar o agendamento
- Sempre cumprimente adequadamente
- Se o cliente quiser cancelar, confirme antes de executar
- Disponível apenas durante o horário de funcionamento
- Não invente informações sobre serviços ou profissionais
- Para resolver datas relativas ("amanhã", "segunda-feira", etc.), use a data ISO atual fornecida acima
- OBRIGATÓRIO: ao chamar funções como createAppointment ou getAvailableSlots, use SEMPRE os UUID completos de ID_INTERNO, nunca nomes`;  
  }
}
