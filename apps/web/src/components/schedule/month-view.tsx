'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Appointment, Service, DAY_NAMES } from './types';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number;
  appointments: Appointment[];
  services: Service[];
  onDayClick: (date: Date) => void;
}

export default function MonthView({
  year,
  month,
  appointments,
  services,
  onDayClick,
}: MonthViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(new Date(year, month));
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [year, month]);

  const getAppointmentsForDay = useMemo(() => {
    return (date: Date): Appointment[] => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return appointments.filter((a) => {
        const aptDate = typeof a.date === 'string' ? a.date.substring(0, 10) : '';
        return aptDate === dateStr && a.status !== 'CANCELLED';
      });
    };
  }, [appointments]);

  const getServiceColor = (serviceId: string): string => {
    const service = services.find((s) => s.id === serviceId);
    return service?.color || '#10b981';
  };

  const today = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold text-gray-500 uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dayAppointments = getAppointmentsForDay(day);
          const inMonth = isSameMonth(day, new Date(year, month));
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'min-h-[80px] sm:min-h-[100px] p-1.5 border-b border-r border-gray-100 text-left hover:bg-gray-50 transition-colors',
                !inMonth && 'bg-gray-50/50',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isToday && 'bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs',
                    !isToday && inMonth && 'text-gray-900',
                    !isToday && !inMonth && 'text-gray-400',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayAppointments.length > 0 && (
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {dayAppointments.length}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-1 px-1 py-0.5 rounded"
                    style={{
                      backgroundColor: `${getServiceColor(apt.serviceId)}20`,
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getServiceColor(apt.serviceId) }}
                    />
                    <span className="text-[9px] text-gray-700 truncate font-medium">
                      {apt.startTime} {apt.clientName}
                    </span>
                  </div>
                ))}
                {dayAppointments.length > 3 && (
                  <p className="text-[9px] text-gray-500 px-1">
                    +{dayAppointments.length - 3} mais
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
