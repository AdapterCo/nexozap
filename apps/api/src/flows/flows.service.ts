import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';

interface FlowNode {
  id: string;
  type: string;
  data: any;
  position?: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const conversationStateMap = new Map<string, { currentNodeId: string; answers: Record<string, any> }>();

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.flow.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, companyId: string) {
    const flow = await this.prisma.flow.findFirst({
      where: { id, companyId },
    });

    if (!flow) {
      throw new NotFoundException('Fluxo não encontrado');
    }

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

  async execute(conversationId: string, userMessage: string, companyId: string) {
    const activeFlow = await this.prisma.flow.findFirst({
      where: { companyId, isActive: true },
    });

    if (!activeFlow) {
      return { response: 'Olá! Como posso ajudá-lo?', completed: false };
    }

    const nodes = (activeFlow.nodes as any[]) as FlowNode[];
    const edges = (activeFlow.edges as any[]) as FlowEdge[];

    if (!nodes.length) {
      return { response: 'Fluxo sem nós configurados.', completed: true };
    }

    let state = conversationStateMap.get(conversationId);

    if (!state) {
      const startNode = nodes.find((n) => n.type === 'START') || nodes[0];
      state = { currentNodeId: startNode.id, answers: {} };
      conversationStateMap.set(conversationId, state);
    }

    const currentNode = nodes.find((n) => n.id === state.currentNodeId);

    if (!currentNode) {
      conversationStateMap.delete(conversationId);
      return { response: 'Fluxo finalizado.', completed: true };
    }

    const result = await this.processNode(currentNode, userMessage, state, nodes, edges, companyId, conversationId);

    return result;
  }

  private async processNode(
    node: FlowNode,
    userMessage: string,
    state: { currentNodeId: string; answers: Record<string, any> },
    nodes: FlowNode[],
    edges: FlowEdge[],
    companyId: string,
    conversationId: string,
  ) {
    switch (node.type) {
      case 'START': {
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          state.currentNodeId = nextEdge.target;
          conversationStateMap.set(conversationId, state);
          return this.processNode(
            nodes.find((n) => n.id === nextEdge.target)!,
            userMessage,
            state,
            nodes,
            edges,
            companyId,
            conversationId,
          );
        }
        return { response: 'Bem-vindo!', completed: false };
      }

      case 'MESSAGE': {
        const message = node.data?.message || node.data?.text || 'Mensagem não configurada';
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          state.currentNodeId = nextEdge.target;
          conversationStateMap.set(conversationId, state);
          return { response: message, completed: false };
        }
        conversationStateMap.delete(conversationId);
        return { response: message, completed: true };
      }

      case 'MENU': {
        const options = node.data?.options || [];
        if (options.length === 0) {
          return { response: 'Menu sem opções.', completed: true };
        }

        const isNumeric = /^\d+$/.test(userMessage.trim());
        if (isNumeric) {
          const idx = parseInt(userMessage.trim(), 10) - 1;
          if (idx >= 0 && idx < options.length) {
            const selectedOption = options[idx];
            const matchingEdge = edges.find(
              (e) => e.source === node.id && (e.label === selectedOption.value || e.label === String(idx)),
            );
            if (matchingEdge) {
              state.currentNodeId = matchingEdge.target;
              conversationStateMap.set(conversationId, state);
              return this.processNode(
                nodes.find((n) => n.id === matchingEdge.target)!,
                userMessage,
                state,
                nodes,
                edges,
                companyId,
                conversationId,
              );
            }
          }
        }

        const menuText = node.data?.message || 'Escolha uma opção:';
        const optionsText = options.map((opt: any, i: number) => `${i + 1}. ${opt.label}`).join('\n');
        return { response: `${menuText}\n${optionsText}`, completed: false };
      }

      case 'QUESTION': {
        const savedKey = node.data?.variable || node.id;
        if (userMessage.trim()) {
          state.answers[savedKey] = userMessage.trim();
          const nextEdge = edges.find((e) => e.source === node.id);
          if (nextEdge) {
            state.currentNodeId = nextEdge.target;
            conversationStateMap.set(conversationId, state);
            return this.processNode(
              nodes.find((n) => n.id === nextEdge.target)!,
              userMessage,
              state,
              nodes,
              edges,
              companyId,
              conversationId,
            );
          }
          conversationStateMap.delete(conversationId);
          return { response: 'Obrigado pela informação!', completed: true };
        }
        const question = node.data?.question || 'Por favor, responda:';
        return { response: question, completed: false };
      }

      case 'CONDITION': {
        const variable = node.data?.variable || '';
        const operator = node.data?.operator || 'equals';
        const value = node.data?.value || '';
        const storedValue = state.answers[variable] || '';

        let conditionMet = false;
        switch (operator) {
          case 'equals':
            conditionMet = String(storedValue).toLowerCase() === String(value).toLowerCase();
            break;
          case 'contains':
            conditionMet = String(storedValue).toLowerCase().includes(String(value).toLowerCase());
            break;
          case 'gt':
            conditionMet = Number(storedValue) > Number(value);
            break;
          case 'lt':
            conditionMet = Number(storedValue) < Number(value);
            break;
          case 'notEmpty':
            conditionMet = String(storedValue).trim().length > 0;
            break;
          default:
            conditionMet = String(storedValue) === String(value);
        }

        const edgeLabel = conditionMet ? 'true' : 'false';
        const matchingEdge = edges.find(
          (e) => e.source === node.id && e.label === edgeLabel,
        );

        if (matchingEdge) {
          state.currentNodeId = matchingEdge.target;
          conversationStateMap.set(conversationId, state);
          return this.processNode(
            nodes.find((n) => n.id === matchingEdge.target)!,
            userMessage,
            state,
            nodes,
            edges,
            companyId,
            conversationId,
          );
        }

        const defaultEdge = edges.find((e) => e.source === node.id);
        if (defaultEdge) {
          state.currentNodeId = defaultEdge.target;
          conversationStateMap.set(conversationId, state);
          return this.processNode(
            nodes.find((n) => n.id === defaultEdge.target)!,
            userMessage,
            state,
            nodes,
            edges,
            companyId,
            conversationId,
          );
        }

        conversationStateMap.delete(conversationId);
        return { response: 'Condição avaliada, mas sem ramificação definida.', completed: true };
      }

      case 'SCHEDULING': {
        const services = await this.prisma.service.findMany({
          where: { companyId, isActive: true },
        });

        if (services.length === 0) {
          return { response: 'Nenhum serviço disponível no momento.', completed: true };
        }

        const savedKey = node.data?.variable || 'scheduling';
        state.answers[savedKey] = userMessage.trim();
        conversationStateMap.set(conversationId, state);

        const servicesText = services.map((s, i) => `${i + 1}. ${s.name} - R$ ${s.price.toFixed(2)} (${s.durationMinutes} min)`).join('\n');
        return {
          response: `Para agendar, escolha um serviço:\n${servicesText}`,
          completed: false,
        };
      }

      case 'TRANSFER': {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { mode: 'HUMAN' },
        });
        conversationStateMap.delete(conversationId);
        return { response: 'Transferindo para atendente humano. Aguarde um momento.', completed: true };
      }

      case 'END': {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { status: 'CLOSED', endedAt: new Date() },
        });
        conversationStateMap.delete(conversationId);
        return { response: node.data?.message || 'Conversa finalizada. Obrigado!', completed: true };
      }

      default: {
        const nextEdge = edges.find((e) => e.source === node.id);
        if (nextEdge) {
          state.currentNodeId = nextEdge.target;
          conversationStateMap.set(conversationId, state);
          return this.processNode(
            nodes.find((n) => n.id === nextEdge.target)!,
            userMessage,
            state,
            nodes,
            edges,
            companyId,
            conversationId,
          );
        }
        conversationStateMap.delete(conversationId);
        return { response: 'Fluxo finalizado.', completed: true };
      }
    }
  }
}
