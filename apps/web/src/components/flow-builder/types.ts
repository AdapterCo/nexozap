export type NodeType = 'START' | 'MESSAGE' | 'MENU' | 'QUESTION' | 'CONDITION' | 'SCHEDULING' | 'TRANSFER' | 'END';

export interface FlowNodeData {
  id: string;
  type: NodeType;
  label: string;
  content?: string;
  options?: { id: string; text: string }[];
  question?: string;
  variableName?: string;
  conditionType?: string;
  conditionValue?: string;
  collectService?: boolean;
  collectProfessional?: boolean;
  collectDate?: boolean;
  collectTime?: boolean;
  transferMessage?: string;
  endMessage?: string;
  position: { x: number; y: number };
}

export interface FlowEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  label?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  createdAt: string;
  updatedAt: string;
}
