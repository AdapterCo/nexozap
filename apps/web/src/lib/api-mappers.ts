import type { Professional, Service } from '@/components/schedule/types';

export function mapService(value: any): Service {
  return {
    id: value.id,
    name: value.name,
    description: value.description || '',
    duration: value.durationMinutes ?? value.duration ?? 30,
    price: Number(value.price ?? 0),
    color: value.color || 'green',
    active: value.isActive ?? value.active ?? true,
  };
}

export function mapProfessional(value: any): Professional {
  const hours = value.workingHours?.default ?? value.workingHours ?? {};
  return {
    id: value.id,
    name: value.name,
    specialty: value.specialty || '',
    avatar: value.photo ?? value.avatar,
    active: value.isActive ?? value.active ?? true,
    workingDays: value.availableDays ?? value.workingDays ?? [],
    workingHoursStart: hours.start ?? value.workingHoursStart ?? '09:00',
    workingHoursEnd: hours.end ?? value.workingHoursEnd ?? '18:00',
    services: (value.services ?? []).map((item: any) => item.serviceId ?? item.service?.id ?? item),
  };
}

export function mapFlow<T extends Record<string, any>>(value: T) {
  return { ...value, active: value.isActive ?? value.active ?? false };
}
