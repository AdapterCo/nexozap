'use client';

import { useRef, useState, useCallback } from 'react';
import { useFlowStore } from './flow-store';
import { FlowNodeData } from './types';
import EdgeLine from './edge-line';
import MessageNode from './nodes/message-node';
import MenuNode from './nodes/menu-node';
import QuestionNode from './nodes/question-node';
import ConditionNode from './nodes/condition-node';
import SchedulingNode from './nodes/scheduling-node';
import TransferNode from './nodes/transfer-node';
import EndNode from './nodes/end-node';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeRendererProps {
  node: FlowNodeData;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onInputMouseDown: (e: React.MouseEvent) => void;
  onOutputMouseDown: (e: React.MouseEvent, handle?: string) => void;
  onSelect: (e: React.MouseEvent) => void;
}

function StartNode({ node, selected, onMouseDown, onInputMouseDown, onOutputMouseDown, onSelect }: NodeRendererProps) {
  return (
    <div
      className={cn(
        'w-56 bg-white rounded-lg shadow-md border-l-4 border-gray-400 cursor-grab active:cursor-grabbing select-none',
        selected && 'ring-2 ring-gray-400 shadow-lg',
      )}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <Play size={14} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-700">Início</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs text-gray-500">Ponto de entrada do fluxo</p>
      </div>
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 hover:border-gray-500 cursor-crosshair z-10"
        onMouseDown={(e) => { e.stopPropagation(); onOutputMouseDown(e); }}
      />
    </div>
  );
}

function NodeRenderer({ node, selected, onMouseDown, onInputMouseDown, onOutputMouseDown, onSelect }: NodeRendererProps) {
  const props = { node, selected, onMouseDown, onInputMouseDown, onOutputMouseDown, onSelect };

  switch (node.type) {
    case 'START':
      return <StartNode {...props} />;
    case 'MESSAGE':
      return <MessageNode {...props} />;
    case 'MENU':
      return <MenuNode {...props} />;
    case 'QUESTION':
      return <QuestionNode {...props} />;
    case 'CONDITION':
      return <ConditionNode {...props} />;
    case 'SCHEDULING':
      return <SchedulingNode {...props} />;
    case 'TRANSFER':
      return <TransferNode {...props} />;
    case 'END':
      return <EndNode {...props} />;
    default:
      return null;
  }
}

export default function FlowCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { nodes, edges, selectedNodeId, selectNode, moveNode, connectingFrom, startConnecting, completeConnecting, cancelConnecting } = useFlowStore();

  const [dragging, setDragging] = useState<{ nodeId: string; startX: number; startY: number; nodeStartX: number; nodeStartY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const node = useFlowStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDragging({
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.position.x,
      nodeStartY: node.position.y,
    });
    selectNode(nodeId);
  }, [selectNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      moveNode(dragging.nodeId, {
        x: dragging.nodeStartX + dx,
        y: dragging.nodeStartY + dy,
      });
    } else if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }, [dragging, isPanning, moveNode]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      selectNode(null);
      if (connectingFrom) {
        cancelConnecting();
      }
      if (e.button === 0 && !connectingFrom) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      }
    }
  }, [selectNode, connectingFrom, cancelConnecting, pan]);

  const handleInputMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFrom) {
      completeConnecting(nodeId);
    }
  }, [connectingFrom, completeConnecting]);

  const handleOutputMouseDown = useCallback((nodeId: string, e: React.MouseEvent, handle?: string) => {
    e.stopPropagation();
    startConnecting(nodeId, handle);
  }, [startConnecting]);

  return (
    <div
      ref={canvasRef}
      className="flex-1 relative overflow-hidden bg-gray-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleCanvasMouseDown}
    >
      <div
        className="absolute inset-0 canvas-bg"
        style={{
          backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {connectingFrom && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          Clique no nó de destino para conectar
          <button
            onClick={(e) => {
              e.stopPropagation();
              cancelConnecting();
            }}
            className="ml-2 underline hover:text-blue-200"
          >
            Cancelar
          </button>
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
          {edges.map((edge) => (
            <EdgeLine key={edge.id} edge={edge} nodes={nodes} />
          ))}
        </svg>

        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute z-[2]"
            style={{ left: node.position.x, top: node.position.y }}
          >
            <NodeRenderer
              node={node}
              selected={selectedNodeId === node.id}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
              onInputMouseDown={(e) => handleInputMouseDown(node.id, e)}
              onOutputMouseDown={(e, handle) => handleOutputMouseDown(node.id, e, handle)}
              onSelect={(e) => { e.stopPropagation(); selectNode(node.id); }}
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setPan({ x: 0, y: 0 })}
          className="px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600"
        >
          Centralizar
        </button>
        <span className="text-[10px] text-gray-400">
          {nodes.length} nós · {edges.length} conexões
        </span>
      </div>
    </div>
  );
}
