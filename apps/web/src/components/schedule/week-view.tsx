'use client';

import { useMemo, useCallback } from 'react';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment, Professional, Service, TIME_SLOTS } from './types';
import AppointmentCard from './appointment-card';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  weekStart: Date;
  appointments: Appointment[];
  professionals: Professional[];
  services: Service[];
  onEmptySlotClick: (date: string, time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const START_HOUR = 8;
const END_HOUR = 20;
const WEEK_DAYS = 7;

export default function WeekView({
  weekStart,
  appointments,
  professionals,
  services,
  onEmptySlotClick,
  onAppointmentClick,
}: WeekViewProps) {
  const weekDays = useMemo(() => {
    return Array.from({ length: WEEK_DAYS }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const filteredSlots = useMemo(() => {
    return TIME_SLOTS.filter((slot) => {
      const hour = parseInt(slot.split(':')[0], 10);
      return hour >= START_HOUR && hour < END_HOUR;
    });
  }, []);

  const getDayAppointments = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return appointments.filter((a) => {
        // a.date pode vir como ISO completo ("2026-06-29T03:00:00.000Z") ou como "yyyy-MM-dd"
        const aptDate = typeof a.date === 'string' ? a.date.substring(0, 10) : '';
        return aptDate === dateStr && a.status !== 'CANCELLED';
      });
    },
    [appointments],
  );

  const getSlotAppointments = useCallback(
    (date: Date, slot: string) => {
      return getDayAppointments(date).filter((a) => a.startTime === slot);
    },
    [getDayAppointments],
  );

  const getService = (serviceId: string) => services.find((s) => s.id === serviceId);
  const getProfessional = (professionalId: string) =>
    professionals.find((p) => p.id === professionalId);

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const currentTimePosition = useMemo(() => {
    if (currentHour < START_HOUR || currentHour >= END_HOUR) return -1;
    return ((currentHour - START_HOUR) * 60 + currentMinute) / 30;
  }, [currentHour, currentMinute]);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
        <div className="p-2" />
        {weekDays.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'p-2 text-center border-l border-gray-100',
                today && 'bg-primary-50',
              )}
            >
              <p className="text-[10px] font-medium text-gray-500 uppercase">
                {format(day, 'EEE', { locale: ptBR })}
              </p>
              <p
                className={cn(
                  'text-sm font-bold mt-0.5',
                  today ? 'text-primary-600' : 'text-gray-900',
                )}
              >
                {format(day, 'dd')}
              </p>
            </div>
          );
        })}
      </div>

      <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
          {filteredSlots.map((slot) => {
            const hour = parseInt(slot.split(':')[0], 10);
            return (
              <div key={slot} className="contents">
                <div className="py-2 pr-2 text-right border-b border-gray-100">
                  <span className="text-[11px] font-medium text-gray-500">{slot}</span>
                </div>
                {weekDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const slotApts = getSlotAppointments(day, slot);
                  const today = isToday(day);

                  return (
                    <div
                      key={`${dateStr}-${slot}`}
                      className={cn(
                        'border-l border-b border-gray-100 min-h-[48px] p-0.5',
                        slotApts.length === 0 && 'hover:bg-gray-50 cursor-pointer',
                        today && 'bg-primary-50/30',
                      )}
                      onClick={() => {
                        if (slotApts.length === 0) {
                          onEmptySlotClick(dateStr, slot);
                        }
                      }}
                    >
                      {slotApts.map((apt) => (
                        <AppointmentCard
                          key={apt.id}
                          appointment={apt}
                          service={getService(apt.serviceId)}
                          professional={getProfessional(apt.professionalId)}
                          onClick={onAppointmentClick}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
