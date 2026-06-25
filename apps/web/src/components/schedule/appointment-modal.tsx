'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Clock, User, Phone, Mail, FileText, Scissors } from 'lucide-react';
import { Appointment, Professional, Service, TIME_SLOTS } from './types';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import useAuthStore from '@/stores/auth-store';

interface AppointmentModalProps {
  appointment: Appointment | null;
  date: string;
  time: string;
  professionals: Professional[];
  services: Service[];
  onClose: () => void;
  onSave: () => void;
}

export default function AppointmentModal({
  appointment,
  date,
  time,
  professionals,
  services,
  onClose,
  onSave,
}: AppointmentModalProps) {
  const { company } = useAuthStore();
  const isEditing = !!appointment;

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [selectedDate, setSelectedDate] = useState(date);
  const [selectedTime, setSelectedTime] = useState(time);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (appointment) {
      setClientName(appointment.clientName);
      setClientPhone(appointment.clientPhone);
      setClientEmail(appointment.clientEmail || '');
      setServiceId(appointment.serviceId);
      setProfessionalId(appointment.professionalId);
      setSelectedDate(appointment.date);
      setSelectedTime(appointment.startTime);
      setNotes(appointment.notes || '');
    } else {
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setServiceId('');
      setProfessionalId('');
      setSelectedDate(date);
      setSelectedTime(time);
      setNotes('');
    }
  }, [appointment, date, time]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId),
    [services, serviceId],
  );

  const filteredProfessionals = useMemo(() => {
    if (!serviceId) return professionals.filter((p) => p.active);
    return professionals.filter((p) => p.active && p.services.includes(serviceId));
  }, [professionals, serviceId]);

  const availableSlots = useMemo(() => {
    if (!professionalId || !selectedService) return TIME_SLOTS.filter((s) => {
      const h = parseInt(s.split(':')[0], 10);
      return h >= 8 && h < 20;
    });

    const prof = professionals.find((p) => p.id === professionalId);
    if (!prof) return TIME_SLOTS.filter((s) => {
      const h = parseInt(s.split(':')[0], 10);
      return h >= 8 && h < 20;
    });

    const startH = parseInt(prof.workingHoursStart.split(':')[0], 10);
    const startM = parseInt(prof.workingHoursStart.split(':')[1] || '0', 10);
    const endH = parseInt(prof.workingHoursEnd.split(':')[0], 10);
    const endM = parseInt(prof.workingHoursEnd.split(':')[1] || '0', 10);

    return TIME_SLOTS.filter((slot) => {
      const [h, m] = slot.split(':').map(Number);
      const slotMin = h * 60 + m;
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      return slotMin >= startMin && slotMin < endMin;
    });
  }, [professionalId, selectedService, professionals]);

  const endTime = useMemo(() => {
    if (!selectedService || !selectedTime) return '';
    const [h, m] = selectedTime.split(':').map(Number);
    const totalMin = h * 60 + m + selectedService.duration;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [selectedTime, selectedService]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    setClientPhone(formatPhone(value));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!clientName.trim()) newErrors.clientName = 'Nome do cliente é obrigatório';
    if (!clientPhone.trim()) newErrors.clientPhone = 'Telefone é obrigatório';
    else if (clientPhone.replace(/\D/g, '').length < 10)
      newErrors.clientPhone = 'Telefone inválido';
    if (!serviceId) newErrors.serviceId = 'Selecione um serviço';
    if (!professionalId) newErrors.professionalId = 'Selecione um profissional';
    if (!selectedDate) newErrors.date = 'Selecione uma data';
    if (!selectedTime) newErrors.time = 'Selecione um horário';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !company?.id) return;

    setSaving(true);
    try {
      const payload = {
        clientName: clientName.trim(),
        clientPhone: clientPhone.replace(/\D/g, ''),
        clientEmail: clientEmail.trim() || undefined,
        serviceId,
        professionalId,
        date: selectedDate,
        startTime: selectedTime,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(`/companies/${company.id}/appointments/${appointment.id}`, payload);
      } else {
        await api.post(`/companies/${company.id}/appointments`, payload);
      }

      onSave();
    } catch {
      setErrors({ general: 'Erro ao salvar agendamento' });
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
              {isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h3>
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
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <User size={14} />
              Nome do Cliente *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome completo"
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.clientName ? 'border-red-300' : 'border-gray-200',
              )}
            />
            {errors.clientName && (
              <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Phone size={14} />
              Telefone *
            </label>
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(00) 00000-0000"
              maxLength={15}
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.clientPhone ? 'border-red-300' : 'border-gray-200',
              )}
            />
            {errors.clientPhone && (
              <p className="text-xs text-red-500 mt-1">{errors.clientPhone}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Mail size={14} />
              E-mail (opcional)
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Scissors size={14} />
              Serviço *
            </label>
            <select
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setProfessionalId('');
              }}
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.serviceId ? 'border-red-300' : 'border-gray-200',
              )}
            >
              <option value="">Selecione um serviço</option>
              {services.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.duration}min — R$ {s.price.toFixed(2)}
                </option>
              ))}
            </select>
            {errors.serviceId && (
              <p className="text-xs text-red-500 mt-1">{errors.serviceId}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <User size={14} />
              Profissional *
            </label>
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              disabled={!serviceId}
              className={cn(
                'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                errors.professionalId ? 'border-red-300' : 'border-gray-200',
                !serviceId && 'bg-gray-50 text-gray-400',
              )}
            >
              <option value="">
                {serviceId ? 'Selecione um profissional' : 'Selecione um serviço primeiro'}
              </option>
              {filteredProfessionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.professionalId && (
              <p className="text-xs text-red-500 mt-1">{errors.professionalId}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                Data *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  errors.date ? 'border-red-300' : 'border-gray-200',
                )}
              />
              {errors.date && (
                <p className="text-xs text-red-500 mt-1">{errors.date}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Clock size={14} />
                Horário *
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  errors.time ? 'border-red-300' : 'border-gray-200',
                )}
              >
                <option value="">Selecionar</option>
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {errors.time && (
                <p className="text-xs text-red-500 mt-1">{errors.time}</p>
              )}
            </div>
          </div>

          {selectedService && selectedTime && (
            <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
              <span className="text-gray-600">Duração estimada:</span>
              <span className="font-semibold text-gray-900">
                {selectedService.duration}min ({selectedTime} — {endTime})
              </span>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <FileText size={14} />
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais..."
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
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
            {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  );
}
