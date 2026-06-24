'use client';

import { useFlowStore } from './flow-store';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlowNodeData } from './types';

export default function PropertiesPanel() {
  const { nodes, selectedNodeId, updateNodeData, removeNode, selectNode } = useFlowStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="w-64 border-l border-gray-200 bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-sm text-gray-400 text-center">
          Selecione um nó para editar suas propriedades
        </p>
      </div>
    );
  }

  const TYPE_LABELS: Record<string, string> = {
    START: 'Início',
    MESSAGE: 'Mensagem',
    MENU: 'Menu',
    QUESTION: 'Pergunta',
    CONDITION: 'Condição',
    SCHEDULING: 'Agendamento',
    TRANSFER: 'Transferência',
    END: 'Encerramento',
  };

  const TYPE_COLORS: Record<string, string> = {
    START: 'bg-gray-100 text-gray-700',
    MESSAGE: 'bg-blue-100 text-blue-700',
    MENU: 'bg-purple-100 text-purple-700',
    QUESTION: 'bg-orange-100 text-orange-700',
    CONDITION: 'bg-yellow-100 text-yellow-700',
    SCHEDULING: 'bg-green-100 text-green-700',
    TRANSFER: 'bg-red-100 text-red-700',
    END: 'bg-gray-100 text-gray-700',
  };

  const handleChange = (field: string, value: unknown) => {
    updateNodeData(node.id, { [field]: value } as Partial<FlowNodeData>);
  };

  return (
    <div className="w-64 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
      <div className="mb-4">
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
            TYPE_COLORS[node.type],
          )}
        >
          {TYPE_LABELS[node.type]}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nome do nó</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => handleChange('label', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        {node.type === 'MESSAGE' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Conteúdo da mensagem
            </label>
            <textarea
              value={node.content || ''}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={4}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Digite a mensagem..."
            />
          </div>
        )}

        {node.type === 'MENU' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Opções do menu
            </label>
            <div className="space-y-2">
              {(node.options || []).map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const newOptions = (node.options || []).map((o) =>
                        o.id === opt.id ? { ...o, text: e.target.value } : o,
                      );
                      handleChange('options', newOptions);
                    }}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                  <button
                    onClick={() => {
                      const { removeMenuOption } = useFlowStore.getState();
                      removeMenuOption(node.id, opt.id);
                    }}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {node.type === 'QUESTION' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pergunta</label>
              <textarea
                value={node.question || ''}
                onChange={(e) => handleChange('question', e.target.value)}
                rows={3}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                placeholder="Digite a pergunta..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nome da variável
              </label>
              <input
                type="text"
                value={node.variableName || ''}
                onChange={(e) => handleChange('variableName', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="ex: nome_cliente"
              />
            </div>
          </>
        )}

        {node.type === 'CONDITION' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tipo de condição
              </label>
              <select
                value={node.conditionType || 'equals'}
                onChange={(e) => handleChange('conditionType', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="equals">Igual a</option>
                <option value="not_equals">Diferente de</option>
                <option value="contains">Contém</option>
                <option value="greater_than">Maior que</option>
                <option value="less_than">Menor que</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Valor de comparação
              </label>
              <input
                type="text"
                value={node.conditionValue || ''}
                onChange={(e) => handleChange('conditionValue', e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Valor..."
              />
            </div>
          </>
        )}

        {node.type === 'SCHEDULING' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Dados a coletar
            </label>
            <div className="space-y-2">
              {[
                { field: 'collectService', label: 'Serviço' },
                { field: 'collectProfessional', label: 'Profissional' },
                { field: 'collectDate', label: 'Data' },
                { field: 'collectTime', label: 'Horário' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!((node as unknown as Record<string, unknown>)[field])}
                    onChange={(e) => handleChange(field, e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-xs text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {node.type === 'TRANSFER' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mensagem de transferência
            </label>
            <textarea
              value={node.transferMessage || ''}
              onChange={(e) => handleChange('transferMessage', e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Mensagem ao transferir..."
            />
          </div>
        )}

        {node.type === 'END' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mensagem de encerramento
            </label>
            <textarea
              value={node.endMessage || ''}
              onChange={(e) => handleChange('endMessage', e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Mensagem final..."
            />
          </div>
        )}
      </div>

      {node.type !== 'START' && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              removeNode(node.id);
              selectNode(null);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 size={14} />
            Excluir nó
          </button>
        </div>
      )}
    </div>
  );
}
