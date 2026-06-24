import { create } from 'zustand';
import { FlowNodeData, FlowEdgeData, NodeType } from './types';

interface FlowState {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  selectedNodeId: string | null;
  connectingFrom: { nodeId: string; handle?: string } | null;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<FlowNodeData>) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  addEdge: (sourceId: string, targetId: string, sourceHandle?: string, label?: string) => void;
  removeEdge: (id: string) => void;
  setFlow: (nodes: FlowNodeData[], edges: FlowEdgeData[]) => void;
  getFlow: () => { nodes: FlowNodeData[]; edges: FlowEdgeData[] };
  startConnecting: (nodeId: string, handle?: string) => void;
  completeConnecting: (targetId: string) => void;
  cancelConnecting: () => void;
  addMenuOption: (nodeId: string) => void;
  removeMenuOption: (nodeId: string, optionId: string) => void;
}

let nodeCounter = 0;

function generateId() {
  nodeCounter += 1;
  return `node_${Date.now()}_${nodeCounter}`;
}

function generateEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const NODE_DEFAULTS: Record<NodeType, Partial<FlowNodeData>> = {
  START: { label: 'Início', content: 'Início do fluxo' },
  MESSAGE: { label: 'Mensagem', content: '' },
  MENU: { label: 'Menu', options: [] },
  QUESTION: { label: 'Pergunta', question: '', variableName: '' },
  CONDITION: { label: 'Condição', conditionType: 'equals', conditionValue: '' },
  SCHEDULING: { label: 'Agendamento' },
  TRANSFER: { label: 'Transferir para humano', transferMessage: '' },
  END: { label: 'Encerrar', endMessage: '' },
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  connectingFrom: null,

  addNode: (type, position) => {
    const id = generateId();
    const defaults = NODE_DEFAULTS[type];
    const newNode: FlowNodeData = {
      id,
      type,
      label: defaults.label || type,
      position,
      ...defaults,
      options: type === 'MENU'
        ? [
            { id: `opt_${Date.now()}_1`, text: 'Opção 1' },
            { id: `opt_${Date.now()}_2`, text: 'Opção 2' },
          ]
        : defaults.options,
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...data } : n)),
    }));
  },

  moveNode: (id, position) => {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
  },

  selectNode: (id) => {
    set({ selectedNodeId: id });
  },

  addEdge: (sourceId, targetId, sourceHandle, label) => {
    const state = get();
    const existing = state.edges.find(
      (e) => e.sourceId === sourceId && e.targetId === targetId && e.sourceHandle === sourceHandle,
    );
    if (existing || sourceId === targetId) return;
    const newEdge: FlowEdgeData = {
      id: generateEdgeId(),
      sourceId,
      targetId,
      sourceHandle,
      label,
    };
    set((state) => ({ edges: [...state.edges, newEdge] }));
  },

  removeEdge: (id) => {
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
  },

  setFlow: (nodes, edges) => {
    set({ nodes, edges, selectedNodeId: null });
  },

  getFlow: () => {
    const { nodes, edges } = get();
    return { nodes, edges };
  },

  startConnecting: (nodeId, handle) => {
    set({ connectingFrom: { nodeId, handle } });
  },

  completeConnecting: (targetId) => {
    const { connectingFrom } = get();
    if (!connectingFrom || connectingFrom.nodeId === targetId) {
      set({ connectingFrom: null });
      return;
    }
    get().addEdge(connectingFrom.nodeId, targetId, connectingFrom.handle);
    set({ connectingFrom: null });
  },

  cancelConnecting: () => {
    set({ connectingFrom: null });
  },

  addMenuOption: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'MENU') return;
    const options = node.options || [];
    const newOption = { id: `opt_${Date.now()}`, text: `Opção ${options.length + 1}` };
    get().updateNodeData(nodeId, { options: [...options, newOption] });
  },

  removeMenuOption: (nodeId, optionId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'MENU') return;
    const options = (node.options || []).filter((o) => o.id !== optionId);
    get().updateNodeData(nodeId, { options });
    set((state) => ({
      edges: state.edges.filter(
        (e) => !(e.sourceId === nodeId && e.sourceHandle === optionId),
      ),
    }));
  },
}));
