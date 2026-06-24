'use client';

import { MessageSquare } from 'lucide-react';
import { FlowNodeData } from '../types';
import { cn } from '@/lib/utils';

interface NodeProps {
  node: FlowNodeData;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onInputMouseDown: (e: React.MouseEvent) => void;
  onOutputMouseDown: (e: React.MouseEvent, handle?: string) => void;
  onSelect: (e: React.MouseEvent) => void;
}

export default function MessageNode({ node, selected, onMouseDown, onInputMouseDown, onOutputMouseDown, onSelect }: NodeProps) {
  return (
    <div
      className={cn(
        'w-56 bg-white rounded-lg shadow-md border-l-4 border-blue-500 cursor-grab active:cursor-grabbing select-none',
        selected && 'ring-2 ring-blue-400 shadow-lg',
      )}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-blue-500 cursor-crosshair z-10"
        onMouseDown={(e) => { e.stopPropagation(); onInputMouseDown(e); }}
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <MessageSquare size={14} className="text-blue-500" />
        <span className="text-xs font-semibold text-gray-700">Mensagem</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-600 truncate max-w-[180px]">
          {node.content || 'Clique para editar...'}
        </p>
      </div>
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-blue-500 cursor-crosshair z-10"
        onMouseDown={(e) => { e.stopPropagation(); onOutputMouseDown(e); }}
      />
    </div>
  );
}
