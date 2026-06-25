'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, GitBranch, ArrowRight } from 'lucide-react';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { mapFlow } from '@/lib/api-mappers';

interface Flow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  nodes: unknown[];
  createdAt: string;
}

export default function FluxosPage() {
  const router = useRouter();
  const { company } = useAuthStore();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    fetchFlows();
  }, [company?.id]);

  const fetchFlows = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/companies/${company.id}/flows`);
      setFlows(Array.isArray(res.data) ? res.data.map(mapFlow) : []);
    } catch {
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (flow: Flow) => {
    try {
      if (!flow.active) {
        await api.patch(`/companies/${company?.id}/flows/${flow.id}/toggle`);
        setFlows((prev) =>
          prev.map((f) =>
            f.id === flow.id ? { ...f, active: true } : { ...f, active: false },
          ),
        );
      } else {
        await api.patch(`/companies/${company?.id}/flows/${flow.id}/toggle`);
        setFlows((prev) => prev.map((f) => (f.id === flow.id ? { ...f, active: false } : f)));
      }
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/companies/${company?.id}/flows/${id}`);
      setFlows((prev) => prev.filter((f) => f.id !== id));
      setDeletingId(null);
    } catch {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (!company?.id) return;
    try {
      const res = await api.post(`/companies/${company.id}/flows`, {
        name: 'Novo Fluxo',
        description: '',
        nodes: [
          {
            id: 'start',
            type: 'START',
            label: 'Início',
            position: { x: 250, y: 50 },
          },
        ],
        edges: [],
      });
      router.push(`/fluxos/${res.data.id}`);
    } catch {
      // silently fail
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Fluxos de Atendimento</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          Novo Fluxo
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-gray-400">
          <GitBranch size={48} className="mb-3" />
          <p className="text-lg font-medium text-gray-500">Nenhum fluxo criado</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Crie seu primeiro fluxo de atendimento automatizado
          </p>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Plus size={16} />
            Criar primeiro fluxo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className={cn(
                'card p-5 relative group transition-all cursor-pointer hover:shadow-md',
                !flow.active && 'opacity-70',
              )}
              onClick={() => router.push(`/fluxos/${flow.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      flow.active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    <GitBranch size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{flow.name}</h3>
                    {flow.description && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-[180px] truncate">
                        {flow.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive(flow);
                  }}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors shrink-0',
                    flow.active ? 'bg-primary-500' : 'bg-gray-300',
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                      flow.active ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mt-4">
                <div className="flex items-center gap-1.5">
                  <GitBranch size={14} className="text-gray-400" />
                  <span>{flow.nodes?.length || 0} nós</span>
                </div>
                <span
                  className={cn(
                    'badge text-[10px]',
                    flow.active ? 'badge-success' : 'badge-neutral',
                  )}
                >
                  {flow.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  Criado em {formatDate(flow.createdAt)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(flow.id);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/fluxos/${flow.id}`);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    Abrir
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeletingId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir fluxo?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Esta ação não pode ser desfeita. O fluxo e todos os seus nós serão removidos permanentemente.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
