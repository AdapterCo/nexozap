'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { useFlowStore } from '@/components/flow-builder/flow-store';
import NodePalette from '@/components/flow-builder/node-palette';
import FlowCanvas from '@/components/flow-builder/flow-canvas';
import PropertiesPanel from '@/components/flow-builder/properties-panel';
import { cn } from '@/lib/utils';

export default function FlowEditorPage() {
  const router = useRouter();
  const params = useParams();
  const flowId = params.id as string;
  const { company } = useAuthStore();
  const { nodes, edges, setFlow } = useFlowStore();

  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowActive, setFlowActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!flowId) return;
    loadFlow();
  }, [flowId]);

  const loadFlow = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/flows/detail/${flowId}`);
      const flow = res.data;
      setFlowName(flow.name || '');
      setFlowDescription(flow.description || '');
      setFlowActive(flow.active || false);
      setFlow(flow.nodes || [], flow.edges || []);
    } catch {
      setFlow([], []);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/flows/${flowId}`, {
        name: flowName,
        description: flowDescription,
        active: flowActive,
        nodes,
        edges,
      });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const newActive = !flowActive;
    setFlowActive(newActive);
    try {
      await api.patch(`/flows/${flowId}`, { active: newActive });
    } catch {
      setFlowActive(!newActive);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/fluxos')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <div className="h-6 w-px bg-gray-200" />
          {editingName ? (
            <input
              autoFocus
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingName(false);
              }}
              className="text-lg font-bold text-gray-900 border-b-2 border-primary-500 outline-none bg-transparent px-1"
            />
          ) : (
            <h2
              className="text-lg font-bold text-gray-900 cursor-pointer hover:text-primary-600 transition-colors"
              onClick={() => setEditingName(true)}
            >
              {flowName || 'Sem nome'}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleActive}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors',
              flowActive ? 'bg-primary-500' : 'bg-gray-300',
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                flowActive ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </button>
          <span className="text-xs text-gray-500">
            {flowActive ? 'Ativa' : 'Inativa'}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <NodePalette />
        <FlowCanvas />
        <PropertiesPanel />
      </div>
    </div>
  );
}
