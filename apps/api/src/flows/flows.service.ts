import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';

// Schema normalizado para uso interno do motor de fluxos
interface FlowNode {
  id: string;
  type: string;
  data: {
    message?: string;
    question?: string;
    variable?: string;
    operator?: string;
    value?: string;
    options?: { label: string; value: string }[];
    [key: string]: any;
  };
  position?: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string;
}

interface FlowState {
  currentNodeId: string;
  answers: Record<string, any>;
}

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async list(companyId: string) {
    return this.prisma.flow.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, companyId: string) {
    const flow = await this.prisma.flow.findFirst({ where: { id, companyId } });
    if (!flow) throw new NotFoundException('Fluxo não encontrado');
    return flow;
  }

  async create(companyId: string, dto: CreateFlowDto) {
    return this.prisma.flow.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        nodes: dto.nodes as any,
        edges: dto.edges as any,
      },
    });
  }

  async update(id: string, companyId: string, dto: Partial<CreateFlowDto>) {
    await this.getById(id, companyId);
    return this.prisma.flow.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.nodes !== undefined && { nodes: dto.nodes as any }),
        ...(dto.edges !== undefined && { edges: dto.edges as any }),
      },
    });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);
    return this.prisma.flow.delete({ where: { id } });
  }

  async toggle(id: string, companyId: string) {
    const flow = await this.getById(id, companyId);
    if (!flow.isActive) {
      await this.prisma.flow.updateMany({
        where: { companyId, isActive: true },
        data: { isActive: false },
      });
    }
    return this.prisma.flow.update({
      where: { id },
      data: { isActive: !flow.isActive },
    });
  }

  // ─── MOTOR DE FLUXO ───────────────────────────────────────────────────────

  async execute(conversationId: string, userMessage: string, companyId: string) {
    const activeFlow = await this.prisma.flow.findFirst({
      where: { companyId, isActive: true },
    });

    if (!activeFlow) {
      return { response: 'Olá! Como posso ajudá-lo?', completed: false };
    }

    // Normalizar nós e edges para schema unificado (compatível com frontend e backend)
    const nodes = this.normalizeNodes(activeFlow.nodes as any[]);
    const edges = this.normalizeEdges(activeFlow.edges as any[]);

    if (!nodes.length) {
      return { response: 'Fluxo sem nós configurados.', completed: true };
    }

    // Carregar estado persistente do banco
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { flowState: true },
    });

    let state: FlowState;

    if (conversation?.flowState && typeof conversation.flowState === 'object') {
      state = conversation.flowState as FlowState;
    } else {
      const startNode = nodes.find((n) => n.type === 'START') || nodes[0];
      state = { currentNodeId: startNode.id, answers: {} };
    }

    const currentNode = nodes.find((n) => n.id === state.currentNodeId);

    if (!currentNode) {
      // Nó não encontrado — resetar fluxo
      await this.clearFlowState(conversationId);
      return { response: 'Fluxo finalizado.', completed: true };
    }

    const result = await this.processNode(
      currentNode, userMessage, state, nodes, edges, companyId, conversationId,
    );

    return result;
  }

  // ─── NORMALIZAÇÃO DE SCHEMA ───────────────────────────────────────────────

  /**
   * Converte nós salvos pelo frontend (campos top-level como content, question,
   * variableName, options) para o formato interno com tudo em data.
   */
  private normalizeNodes(rawNodes: any[]): FlowNode[] {
    return rawNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        // Mensagem: frontend usa `content`, backend antigo usava `data.message`
        message: n.data?.message ?? n.content ?? n.endMessage ?? n.transferMessage ?? '',
        // Pergunta: frontend usa `question`, backend antigo usava `data.question`
        question: n.data?.question ?? n.question ?? '',
        // Variável: frontend usa `variableName`, backend antigo usava `data.variable`
        variable: n.data?.variable ?? n.variableName ?? '',
        // Condição: frontend usa `conditionType`/`conditionValue`
        operator: n.data?.operator ?? n.conditionType ?? 'equals',
        value: n.data?.value ?? n.conditionValue ?? '',
        // Opções de menu: frontend usa [{id, text}], backend antigo usava [{label, value}]
        options: this.normalizeOptions(n.data?.options ?? n.options),
        // Flags do SCHEDULING
        collectService: n.collectService ?? n.data?.collectService ?? true,
        collectProfessional: n.collectProfessional ?? n.data?.collectProfessional ?? true,
        collectDate: n.collectDate ?? n.data?.collectDate ?? true,
        collectTime: n.collectTime ?? n.data?.collectTime ?? true,
        // Preserva quaisquer outros campos
        ...n.data,
      },
    }));
  }

  private normalizeOptions(options: any[]): { label: string; value: string }[] {
    if (!Array.isArray(options)) return [];
    return options.map((o, i) => ({
      label: o.label ?? o.text ?? `Opção ${i + 1}`,
      value: o.value ?? o.id ?? String(i),
    }));
  }

  /**
   * Converte edges salvos pelo frontend (sourceId/targetId) para source/target.
   */
  private normalizeEdges(rawEdges: any[]): FlowEdge[] {
    return rawEdges.map((e) => ({
      id: e.id,
      source: e.source ?? e.sourceId ?? '',
      target: e.target ?? e.targetId ?? '',
      label: e.label ?? '',
      sourceHandle: e.sourceHandle ?? '',
    }));
  }

  // ─── PERSISTÊNCIA DE ESTADO ───────────────────────────────────────────────

  private async saveFlowState(conversationId: string, state: FlowState) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { flowState: state as any },
    });
  }

  private async clearFlowState(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { flowState: null },
    });
  }

  // ─── PROCESSAMENTO DE NÓS ────────────────────────────────────────────────

  private async processNode(
    node: FlowNode,
    userMessage: string,
    state: FlowState,
    nodes: FlowNode[],
    edges: FlowEdge[],
    companyId: string,
    conversationId: string,
  ): Promise<{ response: string; completed: boolean }> {
    switch (node.type) {
      case 'START': {
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          const nextNode = nodes.find((n) => n.id === nextEdge.target);
          if (!nextNode) {
            await this.clearFlowState(conversationId);
            return { response: 'Fluxo sem continuação após início.', completed: true };
          }
          state.currentNodeId = nextEdge.target;
          await this.saveFlowState(conversationId, state);
          return this.processNode(nextNode, userMessage, state, nodes, edges, companyId, conversationId);
        }
        return { response: 'Bem-vindo!', completed: false };
      }

      case 'MESSAGE': {
        const message = node.data.message || 'Mensagem não configurada';
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          const nextNode = nodes.find((n) => n.id === nextEdge.target);
          if (nextNode) {
            state.currentNodeId = nextEdge.target;
            await this.saveFlowState(conversationId, state);
            return { response: message, completed: false };
          }
        }
        await this.clearFlowState(conversationId);
        return { response: message, completed: true };
      }

      case 'MENU': {
        const options = node.data.options || [];
        if (options.length === 0) {
          return { response: 'Menu sem opções.', completed: true };
        }

        // Verificar se o usuário escolheu uma opção (número ou texto)
        const trimmed = userMessage.trim();
        const isNumeric = /^\d+$/.test(trimmed);

        let selectedIdx = -1;
        if (isNumeric) {
          selectedIdx = parseInt(trimmed, 10) - 1;
        } else {
          // Tentar match por texto da opção
          selectedIdx = options.findIndex(
            (o) => o.label.toLowerCase() === trimmed.toLowerCase(),
          );
        }

        if (selectedIdx >= 0 && selectedIdx < options.length) {
          const selectedOption = options[selectedIdx];
          // Buscar edge pelo value da opção, pelo sourceHandle ou pelo índice
          const matchingEdge = edges.find(
            (e) =>
              e.source === node.id &&
              (e.label === selectedOption.value ||
                e.label === String(selectedIdx) ||
                e.sourceHandle === selectedOption.value),
          );

          if (matchingEdge) {
            const nextNode = nodes.find((n) => n.id === matchingEdge.target);
            if (!nextNode) {
              await this.clearFlowState(conversationId);
              return { response: 'Opção selecionada, mas sem continuação.', completed: true };
            }
            state.currentNodeId = matchingEdge.target;
            await this.saveFlowState(conversationId, state);
            return this.processNode(nextNode, userMessage, state, nodes, edges, companyId, conversationId);
          }
        }

        // Exibir menu
        const menuText = node.data.message || 'Escolha uma opção:';
        const optionsText = options
          .map((opt, i) => `${i + 1}. ${opt.label}`)
          .join('\n');
        return { response: `${menuText}\n${optionsText}`, completed: false };
      }

      case 'QUESTION': {
        const savedKey = node.data.variable || node.id;
        if (userMessage.trim()) {
          state.answers[savedKey] = userMessage.trim();
          const nextEdge = edges.find((e) => e.source === node.id);
          if (nextEdge) {
            const nextNode = nodes.find((n) => n.id === nextEdge.target);
            if (!nextNode) {
              await this.clearFlowState(conversationId);
              return { response: 'Obrigado pela informação!', completed: true };
            }
            state.currentNodeId = nextEdge.target;
            await this.saveFlowState(conversationId, state);
            return this.processNode(nextNode, userMessage, state, nodes, edges, companyId, conversationId);
          }
          await this.clearFlowState(conversationId);
          return { response: 'Obrigado pela informação!', completed: true };
        }
        const question = node.data.question || 'Por favor, responda:';
        return { response: question, completed: false };
      }

      case 'CONDITION': {
        const variable = node.data.variable || '';
        const operator = node.data.operator || 'equals';
        const value = node.data.value || '';
        const storedValue = state.answers[variable] || '';

        let conditionMet = false;
        switch (operator) {
          case 'equals':
            conditionMet = String(storedValue).toLowerCase() === String(value).toLowerCase();
            break;
          case 'not_equals':
            conditionMet = String(storedValue).toLowerCase() !== String(value).toLowerCase();
            break;
          case 'contains':
            conditionMet = String(storedValue).toLowerCase().includes(String(value).toLowerCase());
            break;
          case 'gt':
          case 'greater_than':
            conditionMet = Number(storedValue) > Number(value);
            break;
          case 'lt':
          case 'less_than':
            conditionMet = Number(storedValue) < Number(value);
            break;
          case 'notEmpty':
            conditionMet = String(storedValue).trim().length > 0;
            break;
          default:
            conditionMet = String(storedValue) === String(value);
        }

        const edgeLabel = conditionMet ? 'true' : 'false';
        const matchingEdge = edges.find((e) => e.source === node.id && e.label === edgeLabel);
        const fallbackEdge = matchingEdge ?? edges.find((e) => e.source === node.id);

        if (fallbackEdge) {
          const nextNode = nodes.find((n) => n.id === fallbackEdge.target);
          if (!nextNode) {
            await this.clearFlowState(conversationId);
            return { response: 'Condição avaliada, mas sem ramificação.', completed: true };
          }
          state.currentNodeId = fallbackEdge.target;
          await this.saveFlowState(conversationId, state);
          return this.processNode(nextNode, userMessage, state, nodes, edges, companyId, conversationId);
        }

        await this.clearFlowState(conversationId);
        return { response: 'Condição sem ramificação definida.', completed: true };
      }

      case 'SCHEDULING': {
        return this.processSchedulingNode(
          node, userMessage, state, nodes, edges, companyId, conversationId,
        );
      }

      case 'TRANSFER': {
        const message = node.data.message || 'Transferindo para atendente humano. Aguarde um momento.';
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { mode: 'HUMAN' },
        });
        await this.clearFlowState(conversationId);
        return { response: message, completed: true };
      }

      case 'END': {
        const message = node.data.message || 'Conversa finalizada. Obrigado!';
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: 'CLOSED', endedAt: new Date() },
        });
        await this.clearFlowState(conversationId);
        return { response: message, completed: true };
      }

      default: {
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          const nextNode = nodes.find((n) => n.id === nextEdge.target);
          if (nextNode) {
            state.currentNodeId = nextEdge.target;
            await this.saveFlowState(conversationId, state);
            return this.processNode(nextNode, userMessage, state, nodes, edges, companyId, conversationId);
          }
        }
        await this.clearFlowState(conversationId);
        return { response: 'Fluxo finalizado.', completed: true };
      }
    }
  }

  // ─── NÓ SCHEDULING (MÁQUINA DE ESTADOS MULTI-STEP) ───────────────────────

  private async processSchedulingNode(
    node: FlowNode,
    userMessage: string,
    state: FlowState,
    nodes: FlowNode[],
    edges: FlowEdge[],
    companyId: string,
    conversationId: string,
  ): Promise<{ response: string; completed: boolean }> {
    const prefix = `_sched_${node.id}_`;
    const step: string = state.answers[`${prefix}step`] || 'service';

    const services = await this.prisma.service.findMany({
      where: { companyId, isActive: true },
    });
    const professionals = await this.prisma.professional.findMany({
      where: { companyId, isActive: true },
    });

    if (services.length === 0) {
      return { response: 'Nenhum serviço disponível no momento.', completed: true };
    }

    switch (step) {
      // ── Passo 1: Escolher serviço ──────────────────────────────────────
      case 'service': {
        const idx = parseInt(userMessage.trim(), 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < services.length) {
          state.answers[`${prefix}serviceId`] = services[idx].id;
          state.answers[`${prefix}serviceName`] = services[idx].name;

          if (professionals.length === 0) {
            // Sem profissionais: pular para data
            state.answers[`${prefix}step`] = 'date';
            await this.saveFlowState(conversationId, state);
            return {
              response: `Serviço *${services[idx].name}* selecionado! ✅\n\nAgora, informe a data desejada (DD/MM/AAAA):`,
              completed: false,
            };
          }

          state.answers[`${prefix}step`] = 'professional';
          await this.saveFlowState(conversationId, state);
          const profList = professionals
            .map((p, i) => `${i + 1}. ${p.name}${p.specialty ? ` (${p.specialty})` : ''}`)
            .join('\n');
          return {
            response: `Serviço *${services[idx].name}* selecionado! ✅\n\nEscolha o profissional:\n${profList}`,
            completed: false,
          };
        }

        // Exibir lista de serviços
        const list = services
          .map((s, i) => `${i + 1}. *${s.name}* — R$ ${Number(s.price).toFixed(2)} (${s.durationMinutes} min)`)
          .join('\n');
        return {
          response: `Para agendar, escolha um serviço:\n${list}`,
          completed: false,
        };
      }

      // ── Passo 2: Escolher profissional ────────────────────────────────
      case 'professional': {
        const idx = parseInt(userMessage.trim(), 10) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < professionals.length) {
          state.answers[`${prefix}professionalId`] = professionals[idx].id;
          state.answers[`${prefix}professionalName`] = professionals[idx].name;
          state.answers[`${prefix}step`] = 'date';
          await this.saveFlowState(conversationId, state);
          return {
            response: `Profissional *${professionals[idx].name}* selecionado! ✅\n\nAgora, informe a data desejada (DD/MM/AAAA):`,
            completed: false,
          };
        }

        const profList = professionals
          .map((p, i) => `${i + 1}. ${p.name}${p.specialty ? ` (${p.specialty})` : ''}`)
          .join('\n');
        return {
          response: `Escolha um profissional digitando o número:\n${profList}`,
          completed: false,
        };
      }

      // ── Passo 3: Informar data ─────────────────────────────────────────
      case 'date': {
        const dateStr = this.parseDateInput(userMessage.trim());
        if (!dateStr) {
          return {
            response: 'Data inválida. Por favor, informe no formato DD/MM/AAAA (ex: 28/06/2026):',
            completed: false,
          };
        }

        const professionalId = state.answers[`${prefix}professionalId`];

        // Verificar disponibilidade se há profissional selecionado
        if (professionalId) {
          const slots = await this.getAvailableSlots(professionalId, dateStr, companyId);
          if (slots.length === 0) {
            return {
              response: `Não há horários disponíveis em ${userMessage.trim()} para este profissional. Por favor, informe outra data (DD/MM/AAAA):`,
              completed: false,
            };
          }

          state.answers[`${prefix}date`] = dateStr;
          state.answers[`${prefix}step`] = 'time';
          await this.saveFlowState(conversationId, state);
          const slotList = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
          return {
            response: `Horários disponíveis para ${userMessage.trim()}:\n${slotList}\n\nEscolha um horário pelo número:`,
            completed: false,
          };
        }

        state.answers[`${prefix}date`] = dateStr;
        state.answers[`${prefix}step`] = 'time';
        await this.saveFlowState(conversationId, state);
        return {
          response: `Data ${userMessage.trim()} registrada! ✅\n\nAgora, informe o horário desejado (HH:MM, ex: 10:00):`,
          completed: false,
        };
      }

      // ── Passo 4: Escolher horário ─────────────────────────────────────
      case 'time': {
        const professionalId = state.answers[`${prefix}professionalId`];
        const dateStr = state.answers[`${prefix}date`];
        let timeStr: string | null = null;

        if (professionalId && dateStr) {
          const slots = await this.getAvailableSlots(professionalId, dateStr, companyId);
          const idx = parseInt(userMessage.trim(), 10) - 1;

          if (!isNaN(idx) && idx >= 0 && idx < slots.length) {
            timeStr = slots[idx];
          } else {
            // Tentar parse direto HH:MM
            timeStr = this.parseTimeInput(userMessage.trim());
            if (timeStr && !slots.includes(timeStr)) {
              const slotList = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
              return {
                response: `Horário indisponível. Escolha um dos horários disponíveis:\n${slotList}`,
                completed: false,
              };
            }
          }
        } else {
          timeStr = this.parseTimeInput(userMessage.trim());
        }

        if (!timeStr) {
          return {
            response: 'Horário inválido. Por favor, informe o número do horário ou no formato HH:MM:',
            completed: false,
          };
        }

        state.answers[`${prefix}time`] = timeStr;
        state.answers[`${prefix}step`] = 'name';
        await this.saveFlowState(conversationId, state);
        return {
          response: `Horário *${timeStr}* selecionado! ✅\n\nQual é o seu nome completo?`,
          completed: false,
        };
      }

      // ── Passo 5: Nome do cliente ───────────────────────────────────────
      case 'name': {
        const name = userMessage.trim();
        if (name.length < 3) {
          return { response: 'Por favor, informe seu nome completo:', completed: false };
        }

        state.answers[`${prefix}clientName`] = name;
        state.answers[`${prefix}step`] = 'phone';
        await this.saveFlowState(conversationId, state);
        return {
          response: `Obrigado, *${name}*! 😊\n\nAgora, informe seu número de WhatsApp (com DDD):`,
          completed: false,
        };
      }

      // ── Passo 6: Telefone do cliente ──────────────────────────────────
      case 'phone': {
        const phone = userMessage.trim().replace(/\D/g, '');
        if (phone.length < 10) {
          return {
            response: 'Número inválido. Por favor, informe seu WhatsApp com DDD (ex: 11999999999):',
            completed: false,
          };
        }

        state.answers[`${prefix}clientPhone`] = phone;
        state.answers[`${prefix}step`] = 'confirm';
        await this.saveFlowState(conversationId, state);

        const serviceName = state.answers[`${prefix}serviceName`] || 'Serviço';
        const profName = state.answers[`${prefix}professionalName`] || 'Qualquer profissional';
        const date = this.formatDateBR(state.answers[`${prefix}date`]);
        const time = state.answers[`${prefix}time`];
        const clientName = state.answers[`${prefix}clientName`];

        return {
          response:
            `📋 *Confirme seu agendamento:*\n\n` +
            `• Serviço: *${serviceName}*\n` +
            `• Profissional: *${profName}*\n` +
            `• Data: *${date}*\n` +
            `• Horário: *${time}*\n` +
            `• Nome: *${clientName}*\n` +
            `• Telefone: *${phone}*\n\n` +
            `Confirmar? Digite *1* para SIM ou *2* para cancelar.`,
          completed: false,
        };
      }

      // ── Passo 7: Confirmação e criação do agendamento ─────────────────
      case 'confirm': {
        const answer = userMessage.trim();

        if (answer === '2' || answer.toLowerCase() === 'não' || answer.toLowerCase() === 'nao' || answer.toLowerCase() === 'cancelar') {
          state.answers[`${prefix}step`] = 'service';
          // Limpar dados parciais
          ['serviceId', 'serviceName', 'professionalId', 'professionalName', 'date', 'time', 'clientName', 'clientPhone'].forEach(
            (k) => delete state.answers[`${prefix}${k}`],
          );
          await this.saveFlowState(conversationId, state);
          return { response: 'Agendamento cancelado. Podemos tentar novamente! Escolha um serviço:', completed: false };
        }

        if (answer !== '1' && answer.toLowerCase() !== 'sim' && answer.toLowerCase() !== 'confirmar') {
          return { response: 'Por favor, digite *1* para confirmar ou *2* para cancelar.', completed: false };
        }

        // Criar agendamento
        const serviceId = state.answers[`${prefix}serviceId`];
        const professionalId = state.answers[`${prefix}professionalId`];
        const dateStr = state.answers[`${prefix}date`];
        const time = state.answers[`${prefix}time`];
        const clientName = state.answers[`${prefix}clientName`];
        const clientPhone = state.answers[`${prefix}clientPhone`];

        if (!serviceId || !dateStr || !time || !clientName || !clientPhone) {
          // Dados incompletos — reiniciar
          state.answers[`${prefix}step`] = 'service';
          await this.saveFlowState(conversationId, state);
          return { response: 'Dados incompletos. Vamos começar novamente. Escolha um serviço:', completed: false };
        }

        try {
          const service = await this.prisma.service.findFirst({ where: { id: serviceId, companyId } });
          if (!service) throw new Error('Serviço não encontrado');

          // Calcular horário de fim
          const [h, m] = time.split(':').map(Number);
          const endMinutes = h * 60 + m + service.durationMinutes;
          const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

          // Parsear data local
          const [year, month, day] = dateStr.split('-').map(Number);
          const appointmentDate = new Date(year, month - 1, day);

          // Validar profissional (se especificado)
          if (professionalId) {
            const professional = await this.prisma.professional.findFirst({ where: { id: professionalId, companyId } });
            if (!professional) throw new Error('Profissional não encontrado');

            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = days[appointmentDate.getDay()];
            if (!professional.availableDays.includes(dayName)) {
              throw new Error(`Profissional não disponível neste dia`);
            }
          }

          const appointment = await this.prisma.appointment.create({
            data: {
              companyId,
              serviceId,
              professionalId: professionalId || professionals[0]?.id,
              clientName,
              clientPhone,
              date: appointmentDate,
              startTime: time,
              endTime,
            },
            include: { service: true, professional: true },
          });

          // Limpar estado do scheduling
          Object.keys(state.answers)
            .filter((k) => k.startsWith(prefix))
            .forEach((k) => delete state.answers[k]);

          // Avançar para próximo nó
          const nextEdge = edges.find((e) => e.source === node.id);
          if (nextEdge) {
            const nextNode = nodes.find((n) => n.id === nextEdge.target);
            if (nextNode) {
              state.currentNodeId = nextEdge.target;
              await this.saveFlowState(conversationId, state);
              const confirmMsg =
                `✅ *Agendamento confirmado!*\n\n` +
                `• ${appointment.service.name}\n` +
                `• Com ${appointment.professional.name}\n` +
                `• ${this.formatDateBR(dateStr)} às ${time}`;
              return { response: confirmMsg, completed: false };
            }
          }

          await this.clearFlowState(conversationId);
          return {
            response:
              `✅ *Agendamento confirmado!*\n\n` +
              `• ${appointment.service.name}\n` +
              `• Com ${appointment.professional.name}\n` +
              `• ${this.formatDateBR(dateStr)} às ${time}\n\n` +
              `Obrigado! Até lá! 😊`,
            completed: true,
          };
        } catch (err: any) {
          state.answers[`${prefix}step`] = 'service';
          await this.saveFlowState(conversationId, state);
          return {
            response: `Não foi possível criar o agendamento: ${err.message || 'erro desconhecido'}. Vamos tentar novamente. Escolha um serviço:`,
            completed: false,
          };
        }
      }

      default:
        state.answers[`${prefix}step`] = 'service';
        await this.saveFlowState(conversationId, state);
        return { response: 'Iniciando agendamento. Escolha um serviço:', completed: false };
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  /** Parse DD/MM/AAAA ou AAAA-MM-DD → AAAA-MM-DD */
  private parseDateInput(input: string): string | null {
    // Formato DD/MM/AAAA
    const brMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      if (isNaN(date.getTime())) return null;
      return `${y}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
    }
    // Formato AAAA-MM-DD
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return input;
    return null;
  }

  /** Parse HH:MM */
  private parseTimeInput(input: string): string | null {
    const match = input.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return null;
  }

  /** AAAA-MM-DD → DD/MM/AAAA */
  private formatDateBR(dateStr: string): string {
    if (!dateStr) return dateStr;
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Buscar slots disponíveis para um profissional em uma data */
  private async getAvailableSlots(professionalId: string, dateStr: string, companyId: string): Promise<string[]> {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });

    if (!company || !professional) return [];

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (!professional.availableDays.includes(days[date.getDay()])) return [];

    const [openH, openM] = company.openingTime.split(':').map(Number);
    const [closeH, closeM] = company.closingTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const [appointments, timeBlocks] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { professionalId, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['CANCELLED'] } },
      }),
      this.prisma.timeBlock.findMany({
        where: { professionalId, date: { gte: dayStart, lte: dayEnd } },
      }),
    ]);

    const slots: string[] = [];
    for (let m = openMinutes; m < closeMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const slotStart = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const slotEnd = `${String(Math.floor((m + 30) / 60)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`;

      const isOccupied =
        appointments.some((a) => slotStart < a.endTime && slotEnd > a.startTime) ||
        timeBlocks.some((t) => slotStart < t.endTime && slotEnd > t.startTime);

      if (!isOccupied) slots.push(slotStart);
    }

    return slots;
  }
}
