'use client';

import { FlowEdgeData, FlowNodeData } from './types';

interface EdgeLineProps {
  edge: FlowEdgeData;
  nodes: FlowNodeData[];
}

const NODE_WIDTH: Record<string, number> = {
  MESSAGE: 224,
  MENU: 240,
  QUESTION: 224,
  CONDITION: 224,
  SCHEDULING: 224,
  TRANSFER: 224,
  END: 224,
  START: 224,
};

const NODE_HEIGHT = 80;

function getNodeCenter(node: FlowNodeData): { x: number; y: number } {
  const w = NODE_WIDTH[node.type] || 224;
  return {
    x: node.position.x + w / 2,
    y: node.position.y + NODE_HEIGHT / 2,
  };
}

function getOutputPosition(node: FlowNodeData, handle?: string): { x: number; y: number } {
  const w = NODE_WIDTH[node.type] || 224;
  if (node.type === 'MENU' && handle) {
    const options = node.options || [];
    const idx = options.findIndex((o: { id: string; text: string }) => o.id === handle);
    if (idx >= 0) {
      const spacing = w / (options.length + 1);
      return {
        x: node.position.x + spacing * (idx + 1),
        y: node.position.y + NODE_HEIGHT,
      };
    }
  }
  if (node.type === 'CONDITION' && handle) {
    const offset = handle === 'yes' ? w * 0.33 : w * 0.67;
    return {
      x: node.position.x + offset,
      y: node.position.y + NODE_HEIGHT,
    };
  }
  return {
    x: node.position.x + w / 2,
    y: node.position.y + NODE_HEIGHT,
  };
}

function getInputPosition(node: FlowNodeData): { x: number; y: number } {
  const w = NODE_WIDTH[node.type] || 224;
  return {
    x: node.position.x + w / 2,
    y: node.position.y,
  };
}

const TYPE_COLORS: Record<string, string> = {
  START: '#9ca3af',
  MESSAGE: '#3b82f6',
  MENU: '#a855f7',
  QUESTION: '#f97316',
  CONDITION: '#eab308',
  SCHEDULING: '#22c55e',
  TRANSFER: '#ef4444',
  END: '#9ca3af',
};

export default function EdgeLine({ edge, nodes }: EdgeLineProps) {
  const sourceNode = nodes.find((n) => n.id === edge.sourceId);
  const targetNode = nodes.find((n) => n.id === edge.targetId);

  if (!sourceNode || !targetNode) return null;

  const from = getOutputPosition(sourceNode, edge.sourceHandle);
  const to = getInputPosition(targetNode);

  const midY = (from.y + to.y) / 2;
  const controlOffset = Math.abs(to.y - from.y) * 0.4 + 40;

  const path = `M ${from.x} ${from.y} C ${from.x} ${from.y + controlOffset}, ${to.x} ${to.y - controlOffset}, ${to.x} ${to.y}`;

  const color = TYPE_COLORS[sourceNode.type] || '#9ca3af';

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.6}
      />
      <circle cx={from.x} cy={from.y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
      <circle cx={to.x} cy={to.y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
      {edge.label && (
        <text
          x={(from.x + to.x) / 2}
          y={(from.y + to.y) / 2 - 6}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
          fontWeight={500}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}
