'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import DayView from '@/components/schedule/day-view';
import WeekView from '@/components/schedule/week-view';
import MonthView from '@/components/schedule/month-view';
import AppointmentModal from '@/components/schedule/appointment-modal';
import BlockTimeModal from '@/components/schedule/block-time-modal';
import useAuthStore from '@/stores/auth-store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { Appointment, Professional, Service } from '@/components/schedule/types';
import { mapProfessional, mapService } from '@/lib/api-mappers';

type ViewType = 'day' | 'week' | 'month';

export default function AgendaPage() {
  const { company } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('week');
  const [professionalFilter, setProfessionalFilter] = useState<string>('all');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [professionalDropdownOpen, setProfessionalDropdownOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [appointmentsRes, professionalsRes, servicesRes] = await Promise.all([
        api.get(`/companies/${company.id}/appointments`).catch(() => ({ data: [] })),
        api.get(`/companies/${company.id}/professionals`).catch(() => ({ data: [] })),
        api.get(`/companies/${company.id}/services`).catch(() => ({ data: [] })),
      ]);
      setAppointments(Array.isArray(appointmentsRes.data) ? appointmentsRes.data : []);
      setProfessionals(Array.isArray(professionalsRes.data) ? professionalsRes.data.map(mapProfessional) : []);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data.map(mapService) : []);
    } catch {
      setAppointments([]);
      setProfessionals([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return;
    fetchData();
  }, [company?.id, fetchData]);

  const filteredAppointments = useMemo(() => {
    if (professionalFilter === 'all') return appointments;
    return appointments.filter((a) => a.professionalId === professionalFilter);
  }, [appointments, professionalFilter]);

  const handlePrev = () => {
    if (viewType === 'day') setCurrentDate((d) => addDays(d, -1));
    else if (viewType === 'week') setCurrentDate((d) => addWeeks(d, -1));
    else setCurrentDate((d) => addMonths(d, -1));
  };

  const handleNext = () => {
    if (viewType === 'day') setCurrentDate((d) => addDays(d, 1));
    else if (viewType === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleEmptySlotClick = (date: string, time: string) => {
    setEditingAppointment(null);
    setSelectedDate(date);
    setSelectedTime(time);
    setShowAppointmentModal(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedDate(appointment.date);
    setSelectedTime(appointment.startTime);
    setShowAppointmentModal(true);
  };

  const handleModalClose = () => {
    setShowAppointmentModal(false);
    setEditingAppointment(null);
    setSelectedDate('');
    setSelectedTime('');
  };

  const handleModalSave = async () => {
    handleModalClose();
    await fetchData();
  };

  const handleBlockTimeSave = async () => {
    setShowBlockTimeModal(false);
    await fetchData();
  };

  const getDateLabel = () => {
    if (viewType === 'day') {
      return format(currentDate, "dd 'de' MMMM, yyyy", { locale: ptBR });
    }
    if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(weekStart, "dd MMM", { locale: ptBR })} — ${format(weekEnd, "dd MMM, yyyy", { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const currentProfessionalName = useMemo(() => {
    if (professionalFilter === 'all') return 'Todos os profissionais';
    const prof = professionals.find((p) => p.id === professionalFilter);
    return prof?.name || 'Todos os profissionais';
  }, [professionalFilter, professionals]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Agenda</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBlockTimeModal(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Bloquear Horário
          </button>
          <button
            onClick={() => handleEmptySlotClick(format(new Date(), 'yyyy-MM-dd'), '09:00')}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Novo Agendamento
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewType(v)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  viewType === v
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {getDateLabel()}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setProfessionalDropdownOpen(!professionalDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[220px]"
          >
            <CalendarIcon size={16} className="text-gray-400 shrink-0" />
            <span className="truncate">{currentProfessionalName}</span>
            <ChevronRight
              size={14}
              className={cn(
                'text-gray-400 shrink-0 ml-auto transition-transform',
                professionalDropdownOpen && 'rotate-90',
              )}
            />
          </button>
          {professionalDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
              <button
                onClick={() => {
                  setProfessionalFilter('all');
                  setProfessionalDropdownOpen(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors',
                  professionalFilter === 'all'
                    ? 'font-semibold text-primary-700 bg-primary-50'
                    : 'text-gray-700',
                )}
              >
                Todos os profissionais
              </button>
              {professionals.map((prof) => (
                <button
                  key={prof.id}
                  onClick={() => {
                    setProfessionalFilter(prof.id);
                    setProfessionalDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors',
                    professionalFilter === prof.id
                      ? 'font-semibold text-primary-700 bg-primary-50'
                      : 'text-gray-700',
                  )}
                >
                  {prof.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <span className="text-sm font-medium text-gray-700 sm:hidden block">
        {getDateLabel()}
      </span>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {viewType === 'day' && (
            <DayView
              date={currentDate}
              appointments={filteredAppointments}
              professionals={professionals}
              services={services}
              onEmptySlotClick={handleEmptySlotClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {viewType === 'week' && (
            <WeekView
              weekStart={weekStart}
              appointments={filteredAppointments}
              professionals={professionals}
              services={services}
              onEmptySlotClick={handleEmptySlotClick}
              onAppointmentClick={handleAppointmentClick}
            />
          )}
          {viewType === 'month' && (
            <MonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              appointments={filteredAppointments}
              services={services}
              onDayClick={(date) => {
                setCurrentDate(date);
                setViewType('day');
              }}
            />
          )}
        </>
      )}

      {showAppointmentModal && (
        <AppointmentModal
          appointment={editingAppointment}
          date={selectedDate}
          time={selectedTime}
          professionals={professionals}
          services={services}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      {showBlockTimeModal && (
        <BlockTimeModal
          professionals={professionals}
          onClose={() => setShowBlockTimeModal(false)}
          onSave={handleBlockTimeSave}
        />
      )}
    </div>
  );
}
