'use client';

import { ListOrdered, Plus } from 'lucide-react';
import { FlowNodeData } from '../types';
import { useFlowStore } from '../flow-store';
import { cn } from '@/lib/utils';

interface NodeProps {
  node: FlowNodeData;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onInputMouseDown: (e: React.MouseEvent) => void;
  onOutputMouseDown: (e: React.MouseEvent, handle?: string) => void;
  onSelect: (e: React.MouseEvent) => void;
}

export default function MenuNode({ node, selected, onMouseDown, onInputMouseDown, onOutputMouseDown, onSelect }: NodeProps) {
  const { addMenuOption } = useFlowStore();
  const options = node.options || [];

  return (
    <div
      className={cn(
        'w-60 bg-white rounded-lg shadow-md border-l-4 border-purple-500 cursor-grab active:cursor-grabbing select-none',
        selected && 'ring-2 ring-purple-400 shadow-lg',
      )}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-purple-500 cursor-crosshair z-10"
        onMouseDown={(e) => { e.stopPropagation(); onInputMouseDown(e); }}
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <ListOrdered size={14} className="text-purple-500" />
        <span className="text-xs font-semibold text-gray-700">Menu</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
              {i + 1}
            </span>
            <span className="truncate flex-1">{opt.text}</span>
            <div
              className="w-3 h-3 rounded-full bg-white border-2 border-gray-300 hover:border-purple-500 cursor-crosshair shrink-0"
              onMouseDown={(e) => { e.stopPropagation(); onOutputMouseDown(e, opt.id); }}
            />
          </div>
        ))}
        <button
          className="flex items-center gap-1 text-[10px] text-purple-500 hover:text-purple-700 mt-1"
          onClick={(e) => { e.stopPropagation(); addMenuOption(node.id); }}
        >
          <Plus size={10} />
          Adicionar opção
        </button>
      </div>
    </div>
  );
}
