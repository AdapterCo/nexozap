'use client';

import { Appointment, Service, Professional } from './types';
import { getStatusLabel, getStatusColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AppointmentCardProps {
  appointment: Appointment;
  service?: Service;
  professional?: Professional;
  compact?: boolean;
  onClick?: (appointment: Appointment) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AppointmentCard({
  appointment,
  service,
  professional,
  compact = false,
  onClick,
}: AppointmentCardProps) {
  const color = service?.color || '#10b981';
  const bgColor = hexToRgba(color, 0.15);
  const borderColor = hexToRgba(color, 0.5);

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(appointment)}
        className={cn(
          'w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity border-l-2',
        )}
        style={{ backgroundColor: bgColor, borderLeftColor: borderColor }}
      >
        <span className="font-semibold text-gray-800 truncate block">
          {appointment.startTime} {appointment.clientName}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick?.(appointment)}
      className={cn(
        'w-full text-left p-2.5 rounded-lg cursor-pointer hover:shadow-md transition-all border-l-4 group',
      )}
      style={{ backgroundColor: bgColor, borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-800 truncate">
            {service?.name || 'Serviço'}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {getInitials(appointment.clientName)}
            </div>
            <p className="text-[11px] text-gray-700 truncate font-medium">
              {appointment.clientName}
            </p>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {appointment.startTime} - {appointment.endTime}
          </p>
          {professional && (
            <p className="text-[10px] text-gray-500 truncate">
              {professional.name}
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold',
            getStatusColor(appointment.status),
          )}
        >
          {getStatusLabel(appointment.status)}
        </span>
      </div>
    </button>
  );
}
