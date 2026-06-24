export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  color: string;
  active: boolean;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  avatar?: string;
  active: boolean;
  workingDays: string[];
  workingHoursStart: string;
  workingHoursEnd: string;
  services: string[];
}

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
}

export interface BlockedTime {
  id: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

export const SERVICE_COLORS: Record<string, string> = {
  green: '#10b981',
  blue: '#3b82f6',
  red: '#ef4444',
  purple: '#8b5cf6',
  yellow: '#f59e0b',
  orange: '#f97316',
  pink: '#ec4899',
};

export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
