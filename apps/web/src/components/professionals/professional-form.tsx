'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Camera } from 'lucide-react';
import { Professional, Service } from '@/components/schedule/types';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';
import { mapService } from '@/lib/api-mappers';

interface ProfessionalFormProps {
  professional: Professional | null;
  onClose: () => void;
  onSave: () => void;
}

const DAY_OPTIONS = [
  { label: 'Segunda', value: 'monday' },
  { label: 'Terça', value: 'tuesday' },
  { label: 'Quarta', value: 'wednesday' },
  { label: 'Quinta', value: 'thursday' },
  { label: 'Sexta', value: 'friday' },
  { label: 'Sábado', value: 'saturday' },
  { label: 'Domingo', value: 'sunday' },
];

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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfessionalForm({
  professional,
  onClose,
  onSave,
}: ProfessionalFormProps) {
  const { company } = useAuthStore();
  const isEditing = !!professional;

  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [workingDays, setWorkingDays] = useState<string[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]);
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (professional) {
      setName(professional.name);
      setSpecialty(professional.specialty || '');
      setWorkingDays(professional.workingDays || []);
      setWorkingHoursStart(professional.workingHoursStart || '09:00');
      setWorkingHoursEnd(professional.workingHoursEnd || '18:00');
      setSelectedServices(professional.services || []);
    }
  }, [professional]);

  useEffect(() => {
    if (!company?.id) return;
    const fetchServices = async () => {
      try {
        const res = await api.get(`/companies/${company.id}/services`);
        setAvailableServices(
          Array.isArray(res.data) ? res.data.map(mapService).filter((s: Service) => s.active) : [],
        );
      } catch {
        setAvailableServices([]);
      }
    };
    fetchServices();
  }, [company?.id]);

  const handleToggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((s) => s !== serviceId)
        : [...prev, serviceId],
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (workingDays.length === 0) newErrors.workingDays = 'Selecione ao menos um dia';
    if (!workingHoursStart) newErrors.workingHoursStart = 'Horário obrigatório';
    if (!workingHoursEnd) newErrors.workingHoursEnd = 'Horário obrigatório';
    if (workingHoursStart && workingHoursEnd && workingHoursStart >= workingHoursEnd)
      newErrors.workingHoursEnd = 'Horário final deve ser após o inicial';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !company?.id) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        specialty: specialty.trim() || undefined,
        availableDays: workingDays,
        workingHours: { default: { start: workingHoursStart, end: workingHoursEnd } },
        serviceIds: selectedServices,
        isActive: professional?.active ?? true,
      };

      if (isEditing) {
        await api.patch(`/companies/${company.id}/professionals/${professional.id}`, payload);
      } else {
        await api.post(`/companies/${company.id}/professionals`, payload);
      }
      onSave();
    } catch {
      setErrors({ general: 'Erro ao salvar profissional' });
    } finally {
      setSaving(false);
    }
  };

  const avatarColor = useMemo(
    () => getAvatarColor(professional?.id || 'new'),
    [professional?.id],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              {isEditing ? 'Editar Profissional' : 'Novo Profissional'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.general}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl',
                  avatarColor,
                )}
              >
                {name ? getInitials(name) : '?'}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera size={20} className="text-white" />
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <p>Photo do profissional</p>
              <p className="text-gray-400">Clique para alterar</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.name ? 'border-red-300' : 'border-gray-200',
              )}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Especialidade
            </label>
            <input
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex: Cabeleireiro, Barbeiro..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Dias de Atendimento *
            </label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => handleToggleDay(day.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    workingDays.includes(day.value)
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {errors.workingDays && (
              <p className="text-xs text-red-500 mt-1">{errors.workingDays}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Horário Início
              </label>
              <input
                type="time"
                value={workingHoursStart}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Horário Fim
              </label>
              <input
                type="time"
                value={workingHoursEnd}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  errors.workingHoursEnd ? 'border-red-300' : 'border-gray-200',
                )}
              />
              {errors.workingHoursEnd && (
                <p className="text-xs text-red-500 mt-1">{errors.workingHoursEnd}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Serviços Disponíveis
            </label>
            {availableServices.length === 0 ? (
              <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
                Nenhum serviço ativo encontrado. Cadastre serviços primeiro.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {availableServices.map((service) => (
                  <label
                    key={service.id}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => handleToggleService(service.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full shrink-0',
                          `bg-${service.color}-500`,
                        )}
                        style={{ backgroundColor: service.color === 'green' ? '#10b981' : service.color === 'blue' ? '#3b82f6' : service.color === 'red' ? '#ef4444' : service.color === 'purple' ? '#8b5cf6' : service.color === 'yellow' ? '#f59e0b' : service.color === 'orange' ? '#f97316' : '#ec4899' }}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">
                        {service.name}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
