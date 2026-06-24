'use client';

import {
  MessageSquare,
  ListOrdered,
  HelpCircle,
  GitBranch,
  Calendar,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { NodeType } from './types';
import { useFlowStore } from './flow-store';
import { cn } from '@/lib/utils';

interface NodeTypeInfo {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const NODE_TYPES: NodeTypeInfo[] = [
  {
    type: 'MESSAGE',
    label: 'Mensagem',
    description: 'Envia uma mensagem de texto',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  },
  {
    type: 'MENU',
    label: 'Menu',
    description: 'Apresenta opções numeradas',
    icon: ListOrdered,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
  },
  {
    type: 'QUESTION',
    label: 'Pergunta',
    description: 'Faz uma pergunta e coleta resposta',
    icon: HelpCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
  },
  {
    type: 'CONDITION',
    label: 'Condição',
    description: 'Verifica uma condição e bifurca o fluxo',
    icon: GitBranch,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
  },
  {
    type: 'SCHEDULING',
    label: 'Agendamento',
    description: 'Coleta dados para agendamento',
    icon: Calendar,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
  },
  {
    type: 'TRANSFER',
    label: 'Transferência',
    description: 'Transfere para um atendente humano',
    icon: UserCheck,
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100 border-red-200',
  },
  {
    type: 'END',
    label: 'Encerramento',
    description: 'Encerra a conversa',
    icon: XCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
  },
];

export default function NodePalette() {
  const { addNode, nodes } = useFlowStore();

  const handleAddNode = (type: NodeType) => {
    const existingNodes = nodes.length;
    const offsetX = existingNodes * 30;
    const offsetY = existingNodes * 20;
    addNode(type, { x: 300 + offsetX, y: 100 + offsetY });
  };

  return (
    <div className="w-56 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
        Tipos de Nó
      </h3>
      <div className="space-y-2">
        {NODE_TYPES.map((nodeType) => {
          const Icon = nodeType.icon;
          return (
            <button
              key={nodeType.type}
              onClick={() => handleAddNode(nodeType.type)}
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all',
                nodeType.bgColor,
              )}
            >
              <div className={cn('shrink-0', nodeType.color)}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold', nodeType.color)}>
                  {nodeType.label}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {nodeType.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
