import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export function formatTime(time: string): string {
  return time;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    SCHEDULED: 'badge-info',
    CONFIRMED: 'badge-success',
    COMPLETED: 'badge-success',
    CANCELLED: 'badge-danger',
    NO_SHOW: 'badge-warning',
    ACTIVE: 'badge-success',
    CLOSED: 'badge-neutral',
    WAITING: 'badge-warning',
    CONNECTED: 'badge-success',
    DISCONNECTED: 'badge-danger',
    RECONNECTING: 'badge-warning',
  };
  return colors[status] || 'badge-neutral';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    SCHEDULED: 'Agendado',
    CONFIRMED: 'Confirmado',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    NO_SHOW: 'Não compareceu',
    ACTIVE: 'Ativa',
    CLOSED: 'Fechada',
    WAITING: 'Aguardando',
    CONNECTED: 'Conectado',
    DISCONNECTED: 'Desconectado',
    RECONNECTING: 'Reconectando',
  };
  return labels[status] || status;
}
