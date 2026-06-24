'use client';

import { useMemo, useCallback } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment, Professional, Service, TIME_SLOTS } from './types';
import AppointmentCard from './appointment-card';
import { cn } from '@/lib/utils';

interface DayViewProps {
  date: Date;
  appointments: Appointment[];
  professionals: Professional[];
  services: Service[];
  onEmptySlotClick: (date: string, time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const START_HOUR = 8;
const END_HOUR = 20;

export default function DayView({
  date,
  appointments,
  professionals,
  services,
  onEmptySlotClick,
  onAppointmentClick,
}: DayViewProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayName = format(date, 'EEEE', { locale: ptBR });
  const dayDate = format(date, "dd 'de' MMMM", { locale: ptBR });

  const filteredSlots = useMemo(() => {
    return TIME_SLOTS.filter((slot) => {
      const hour = parseInt(slot.split(':')[0], 10);
      return hour >= START_HOUR && hour < END_HOUR;
    });
  }, []);

  const dayAppointments = useMemo(() => {
    return appointments.filter((a) => a.date === dateStr && a.status !== 'CANCELLED');
  }, [appointments, dateStr]);

  const getSlotAppointments = useCallback(
    (slot: string) => {
      return dayAppointments.filter((a) => a.startTime === slot);
    },
    [dayAppointments],
  );

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isToday = isSameDay(date, now);

  const currentTimePosition = useMemo(() => {
    if (!isToday) return -1;
    if (currentHour < START_HOUR || currentHour >= END_HOUR) return -1;
    return ((currentHour - START_HOUR) * 60 + currentMinute) / 30;
  }, [isToday, currentHour, currentMinute]);

  const getService = (serviceId: string) => services.find((s) => s.id === serviceId);
  const getProfessional = (professionalId: string) =>
    professionals.find((p) => p.id === professionalId);

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <p className="text-sm text-gray-500 capitalize">{dayName}</p>
        <p className="text-lg font-bold text-gray-900 capitalize">{dayDate}</p>
      </div>
      <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
        <div className="relative">
          {isToday && currentTimePosition >= 0 && (
            <div
              className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
              style={{ top: `${currentTimePosition * 48}px` }}
            >
              <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5" />
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          )}
          {filteredSlots.map((slot) => {
            const slotAppointments = getSlotAppointments(slot);
            const hour = parseInt(slot.split(':')[0], 10);

            return (
              <div
                key={slot}
                className={cn(
                  'flex border-b border-gray-100 min-h-[48px]',
                  slotAppointments.length === 0 && 'hover:bg-gray-50 cursor-pointer',
                )}
                onClick={() => {
                  if (slotAppointments.length === 0) {
                    onEmptySlotClick(dateStr, slot);
                  }
                }}
              >
                <div className="w-16 shrink-0 py-2 pr-3 text-right">
                  <span className="text-xs font-medium text-gray-500">{slot}</span>
                </div>
                <div className="flex-1 py-1 px-1 space-y-1 border-l border-gray-200">
                  {slotAppointments.length > 0 ? (
                    slotAppointments.map((apt) => (
                      <AppointmentCard
                        key={apt.id}
                        appointment={apt}
                        service={getService(apt.serviceId)}
                        professional={getProfessional(apt.professionalId)}
                        onClick={onAppointmentClick}
                      />
                    ))
                  ) : (
                    <div className="h-full min-h-[40px]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
