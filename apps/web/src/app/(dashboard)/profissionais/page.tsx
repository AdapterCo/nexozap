'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Edit2, Trash2 } from 'lucide-react';
import ProfessionalForm from '@/components/professionals/professional-form';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { Professional } from '@/components/schedule/types';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-primary-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ProfissionaisPage() {
  const { company } = useAuthStore();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    fetchProfessionals();
  }, [company?.id]);

  const fetchProfessionals = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/professionals/${company.id}`);
      setProfessionals(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProfessionals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (professional: Professional) => {
    try {
      await api.patch(`/professionals/${professional.id}`, { active: !professional.active });
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === professional.id ? { ...p, active: !p.active } : p,
        ),
      );
    } catch {
      // silently fail
    }
  };

  const handleEdit = (professional: Professional) => {
    setEditingProfessional(professional);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingProfessional(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProfessional(null);
  };

  const handleFormSave = async () => {
    handleFormClose();
    await fetchProfessionals();
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
        <h2 className="text-2xl font-bold text-gray-900">Profissionais</h2>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          Novo Profissional
        </button>
      </div>

      {professionals.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-gray-400">
          <Users size={48} className="mb-3" />
          <p className="text-lg font-medium text-gray-500">
            Nenhum profissional cadastrado
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Adicione profissionais para começar a agendar
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((prof) => (
            <div
              key={prof.id}
              className={cn(
                'card p-5 transition-all',
                !prof.active && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0',
                      getAvatarColor(prof.id),
                    )}
                  >
                    {getInitials(prof.name)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{prof.name}</h3>
                    {prof.specialty && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {prof.specialty}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(prof)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors shrink-0',
                    prof.active ? 'bg-primary-500' : 'bg-gray-300',
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
                      prof.active ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                {prof.services && prof.services.length > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {prof.services.length} serviço{prof.services.length > 1 ? 's' : ''}
                  </span>
                )}
                {prof.workingHoursStart && prof.workingHoursEnd && (
                  <span className="text-xs text-gray-500">
                    {prof.workingHoursStart} — {prof.workingHoursEnd}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleEdit(prof)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Edit2 size={12} />
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProfessionalForm
          professional={editingProfessional}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
