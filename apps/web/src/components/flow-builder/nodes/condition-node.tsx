'use client';

import { GitBranch } from 'lucide-react';
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

export default function ConditionNode({ node, selected, onMouseDown, onInputMouseDown, onOutputMouseDown, onSelect }: NodeProps) {
  return (
    <div
      className={cn(
        'w-56 bg-white rounded-lg shadow-md border-l-4 border-yellow-500 cursor-grab active:cursor-grabbing select-none',
        selected && 'ring-2 ring-yellow-400 shadow-lg',
      )}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-yellow-500 cursor-crosshair z-10"
        onMouseDown={(e) => { e.stopPropagation(); onInputMouseDown(e); }}
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <GitBranch size={14} className="text-yellow-600" />
        <span className="text-xs font-semibold text-gray-700">Condição</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-600 truncate max-w-[180px]">
          {node.conditionType && node.conditionValue
            ? `${node.conditionType}: ${node.conditionValue}`
            : 'Clique para editar...'}
        </p>
      </div>
      <div className="flex justify-between px-4 pb-3">
        <div className="flex flex-col items-center">
          <div
            className="w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-green-500 cursor-crosshair z-10"
            onMouseDown={(e) => { e.stopPropagation(); onOutputMouseDown(e, 'yes'); }}
          />
          <span className="text-[10px] text-green-600 font-medium mt-1">Sim</span>
        </div>
        <div className="flex flex-col items-center">
          <div
            className="w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-red-500 cursor-crosshair z-10"
            onMouseDown={(e) => { e.stopPropagation(); onOutputMouseDown(e, 'no'); }}
          />
          <span className="text-[10px] text-red-600 font-medium mt-1">Não</span>
        </div>
      </div>
    </div>
  );
}
