'use client';

import { useState, useEffect } from 'react';
import { X, Palette } from 'lucide-react';
import { Service, SERVICE_COLORS } from '@/components/schedule/types';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';

interface ServiceFormProps {
  service: Service | null;
  onClose: () => void;
  onSave: () => void;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const COLOR_OPTIONS = [
  { name: 'Verde', value: 'green', class: 'bg-green-500' },
  { name: 'Azul', value: 'blue', class: 'bg-blue-500' },
  { name: 'Vermelho', value: 'red', class: 'bg-red-500' },
  { name: 'Roxo', value: 'purple', class: 'bg-purple-500' },
  { name: 'Amarelo', value: 'yellow', class: 'bg-yellow-500' },
  { name: 'Laranja', value: 'orange', class: 'bg-orange-500' },
  { name: 'Rosa', value: 'pink', class: 'bg-pink-500' },
];

export default function ServiceForm({ service, onClose, onSave }: ServiceFormProps) {
  const { company } = useAuthStore();
  const isEditing = !!service;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState('');
  const [color, setColor] = useState('green');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description || '');
      setDuration(service.duration);
      setPrice(String(service.price));
      setColor(service.color);
      setActive(service.active);
    }
  }, [service]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!duration || duration < 5) newErrors.duration = 'Duração inválida';
    if (!price || parseFloat(price) < 0) newErrors.price = 'Preço inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !company?.id) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        durationMinutes: duration,
        price: parseFloat(price) || 0,
        color,
        isActive: active,
      };

      if (isEditing) {
        await api.patch(`/companies/${company.id}/services/${service.id}`, payload);
      } else {
        await api.post(`/companies/${company.id}/services`, payload);
      }
      onSave();
    } catch {
      setErrors({ general: 'Erro ao salvar serviço' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              {isEditing ? 'Editar Serviço' : 'Novo Serviço'}
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

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Corte de Cabelo"
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
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do serviço..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Duração (minutos) *
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDuration(preset)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    duration === preset
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {preset}min
                </button>
              ))}
            </div>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              min={5}
              max={480}
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.duration ? 'border-red-300' : 'border-gray-200',
              )}
            />
            {errors.duration && (
              <p className="text-xs text-red-500 mt-1">{errors.duration}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Preço (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                R$
              </span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                min={0}
                step={0.01}
                className={cn(
                  'w-full pl-10 pr-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  errors.price ? 'border-red-300' : 'border-gray-200',
                )}
              />
            </div>
            {errors.price && (
              <p className="text-xs text-red-500 mt-1">{errors.price}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Palette size={14} />
              Cor
            </label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-9 h-9 rounded-full transition-all',
                    c.class,
                    color === c.value
                      ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                      : 'hover:scale-105',
                  )}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Ativo</p>
              <p className="text-xs text-gray-500">Serviço disponível para agendamento</p>
            </div>
            <button
              onClick={() => setActive(!active)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                active ? 'bg-primary-500' : 'bg-gray-300',
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                  active ? 'left-[26px]' : 'left-1',
                )}
              />
            </button>
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
