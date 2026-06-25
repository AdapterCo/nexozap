'use client';

import { useState, useEffect } from 'react';
import { Plus, Scissors, Clock, DollarSign, Trash2, Edit2 } from 'lucide-react';
import ServiceForm from '@/components/services/service-form';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { Service } from '@/components/schedule/types';
import { cn, formatCurrency } from '@/lib/utils';
import { mapService } from '@/lib/api-mappers';

export default function ServicosPage() {
  const { company } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    fetchServices();
  }, [company?.id]);

  const fetchServices = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/companies/${company.id}/services`);
      setServices(Array.isArray(res.data) ? res.data.map(mapService) : []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await api.patch(`/companies/${company?.id}/services/${service.id}/toggle`);
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)),
      );
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/companies/${company?.id}/services/${id}`);
      setServices((prev) => prev.filter((s) => s.id !== id));
      setDeletingId(null);
    } catch {
      setDeletingId(null);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingService(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingService(null);
  };

  const handleFormSave = async () => {
    handleFormClose();
    await fetchServices();
  };

  const colorMap: Record<string, string> = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
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
        <h2 className="text-2xl font-bold text-gray-900">Serviços</h2>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          Novo Serviço
        </button>
      </div>

      {services.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-gray-400">
          <Scissors size={48} className="mb-3" />
          <p className="text-lg font-medium text-gray-500">Nenhum serviço cadastrado</p>
          <p className="text-sm text-gray-400 mt-1">Crie seu primeiro serviço para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className={cn(
                'card p-5 relative group transition-all',
                !service.active && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      colorMap[service.color] || 'bg-primary-500',
                    )}
                  >
                    <Scissors size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{service.name}</h3>
                    {service.description && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-[180px] truncate">
                        {service.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(service)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    service.active ? 'bg-primary-500' : 'bg-gray-300',
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                      service.active ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mt-4">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" />
                  <span>{service.duration}min</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-gray-400" />
                  <span>{formatCurrency(service.price)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(service)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Edit2 size={12} />
                  Editar
                </button>
                <button
                  onClick={() => setDeletingId(service.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ServiceForm
          service={editingService}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeletingId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir serviço?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Esta ação não pode ser desfeita. O serviço será removido permanentemente.
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
