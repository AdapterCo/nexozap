'use client';

import { useState } from 'react';
import { X, Ban } from 'lucide-react';
import { Professional, TIME_SLOTS } from './types';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';

interface BlockTimeModalProps {
  professionals: Professional[];
  onClose: () => void;
  onSave: () => void;
}

export default function BlockTimeModal({
  professionals,
  onClose,
  onSave,
}: BlockTimeModalProps) {
  const { company } = useAuthStore();
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!professionalId) newErrors.professionalId = 'Selecione um profissional';
    if (!date) newErrors.date = 'Selecione uma data';
    if (!startTime) newErrors.startTime = 'Selecione o horário inicial';
    if (!endTime) newErrors.endTime = 'Selecione o horário final';
    if (startTime && endTime && startTime >= endTime)
      newErrors.endTime = 'Horário final deve ser após o inicial';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !company?.id) return;

    setSaving(true);
    try {
      await api.post(`/companies/${company.id}/appointments/block-time`, {
        professionalId,
        date,
        startTime,
        endTime,
        reason: reason.trim() || undefined,
      });
      onSave();
    } catch {
      setErrors({ general: 'Erro ao bloquear horário' });
    } finally {
      setSaving(false);
    }
  };

  const filteredSlots = TIME_SLOTS.filter((slot) => {
    const h = parseInt(slot.split(':')[0], 10);
    return h >= 8 && h < 20;
  });

  const endTimeSlots = filteredSlots.filter(
    (slot) => !startTime || slot > startTime,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban size={18} className="text-red-500" />
              <h3 className="text-lg font-bold text-gray-900">Bloquear Horário</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.general}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Profissional *
            </label>
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.professionalId ? 'border-red-300' : 'border-gray-200',
              )}
            >
              <option value="">Selecione</option>
              {professionals
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            {errors.professionalId && (
              <p className="text-xs text-red-500 mt-1">{errors.professionalId}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Data *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.date ? 'border-red-300' : 'border-gray-200',
              )}
            />
            {errors.date && (
              <p className="text-xs text-red-500 mt-1">{errors.date}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Horário Início *
              </label>
              <select
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (endTime && e.target.value >= endTime) setEndTime('');
                }}
                className={cn(
                  'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  errors.startTime ? 'border-red-300' : 'border-gray-200',
                )}
              >
                <option value="">Início</option>
                {filteredSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {errors.startTime && (
                <p className="text-xs text-red-500 mt-1">{errors.startTime}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Horário Fim *
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!startTime}
                className={cn(
                  'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  errors.endTime ? 'border-red-300' : 'border-gray-200',
                  !startTime && 'bg-gray-50 text-gray-400',
                )}
              >
                <option value="">Fim</option>
                {endTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {errors.endTime && (
                <p className="text-xs text-red-500 mt-1">{errors.endTime}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Almoço, reunião..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Bloqueando...' : 'Bloquear'}
          </button>
        </div>
      </div>
    </div>
  );
}
