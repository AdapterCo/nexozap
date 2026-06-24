import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAppointmentsByPhone(phone: string) {
    if (!phone) {
      throw new BadRequestException('Número de telefone é obrigatório');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: { clientPhone: phone },
      include: {
        service: true,
        professional: true,
        company: {
          select: { id: true, name: true, whatsapp: true },
        },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });

    return appointments;
  }

  async cancelAppointment(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, professional: true },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Agendamento já foi cancelado');
    }

    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('Não é possível cancelar um agendamento concluído');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { service: true, professional: true },
    });
  }

  async reschedule(id: string, newDate: string, newTime: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, professional: true },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Agendamento cancelado não pode ser reagendado');
    }

    if (appointment.status === 'COMPLETED') {
      throw new BadRequestException('Agendamento concluído não pode ser reagendado');
    }

    const service = appointment.service;
    const [startH, startM] = newTime.split(':').map(Number);
    const totalMinutes = startH * 60 + startM + service.durationMinutes;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const newDateObj = new Date(newDate);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[newDateObj.getDay()];

    const professional = await this.prisma.professional.findUnique({
      where: { id: appointment.professionalId },
    });

    if (!professional.availableDays.includes(dayName)) {
      throw new BadRequestException('Profissional não disponível neste dia');
    }

    const dayStart = new Date(newDateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(newDateObj);
    dayEnd.setHours(23, 59, 59, 999);

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: appointment.professionalId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
        id: { not: id },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: newTime } },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Horário conflita com agendamento existente');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        date: newDateObj,
        startTime: newTime,
        endTime,
      },
      include: { service: true, professional: true },
    });
  }

  async createEvaluation(appointmentId: string, rating: number, comment?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { evaluation: true },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Apenas agendamentos concluídos podem ser avaliados');
    }

    if (appointment.evaluation) {
      throw new ConflictException('Este agendamento já possui uma avaliação');
    }

    return this.prisma.evaluation.create({
      data: {
        appointmentId,
        rating,
        comment,
      },
      include: {
        appointment: {
          include: { service: true, professional: true },
        },
      },
    });
  }
}
