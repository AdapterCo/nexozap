import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { BlockTimeDto } from './dto/block-time.dto';
import { AppointmentStatus, Prisma } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  /** Normaliza o campo `date` para "yyyy-MM-dd" puro, eliminando fuso horário */
  private formatAppointment(apt: any) {
    if (!apt) return apt;
    const d = apt.date instanceof Date ? apt.date : new Date(apt.date);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return { ...apt, date: `${yyyy}-${mm}-${dd}` };
  }

  async list(
    companyId: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
      professionalId?: string;
      status?: string;
      date?: string;
    },
  ) {
    const where: any = { companyId };

    if (filters.professionalId) {
      where.professionalId = filters.professionalId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.date) {
      const dayStart = new Date(filters.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(filters.date);
      dayEnd.setHours(23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    } else if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        where.date.gte = from;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    const rows = await this.prisma.appointment.findMany({
      where,
      include: {
        service: true,
        professional: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((r) => this.formatAppointment(r));
  }

  async listToday(companyId: string) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const rows = await this.prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: dayStart, lte: dayEnd },
      },
      include: {
        service: true,
        professional: true,
      },
      orderBy: { startTime: 'asc' },
    });
    return rows.map((r) => this.formatAppointment(r));
  }

  async listWeek(companyId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const rows = await this.prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: monday, lte: sunday },
      },
      include: {
        service: true,
        professional: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((r) => this.formatAppointment(r));
  }

  async getById(id: string, companyId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, companyId },
      include: {
        service: true,
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return this.formatAppointment(appointment);
  }

  private async validateAvailability(
    tx: Prisma.TransactionClient,
    companyId: string,
    professionalId: string,
    serviceId: string,
    dateInput: string | Date,
    startTime: string,
    excludeAppointmentId?: string,
  ) {
    const service = await tx.service.findFirst({
      where: { id: serviceId, companyId },
    });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    const professional = await tx.professional.findFirst({
      where: { id: professionalId, companyId },
    });
    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    let appointmentDate: Date;
    if (typeof dateInput === 'string') {
      const [dy, dm, dd] = dateInput.split('-').map(Number);
      appointmentDate = new Date(Date.UTC(dy, dm - 1, dd));
    } else {
      const dy = dateInput.getUTCFullYear();
      const dm = dateInput.getUTCMonth();
      const dd = dateInput.getUTCDate();
      appointmentDate = new Date(Date.UTC(dy, dm, dd));
    }

    const dayName = this.getDayName(appointmentDate);
    if (!professional.availableDays.includes(dayName)) {
      throw new BadRequestException(
        `Profissional não disponível no dia ${dayName}`,
      );
    }

    const company = await tx.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    if (
      startTime < company.openingTime ||
      startTime >= company.closingTime
    ) {
      throw new BadRequestException(
        `Horário fora do expediente da empresa (${company.openingTime} - ${company.closingTime})`,
      );
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const totalMinutes = startH * 60 + startM + service.durationMinutes;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    if (endTime > company.closingTime) {
      throw new BadRequestException(
        'Agendamento excede o horário de encerramento da empresa',
      );
    }

    const dayStart = new Date(appointmentDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(appointmentDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const overlappingAppointment = await tx.appointment.findFirst({
      where: {
        professionalId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
        ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    if (overlappingAppointment) {
      throw new ConflictException(
        `Conflito de horário com agendamento existente (${overlappingAppointment.startTime} - ${overlappingAppointment.endTime})`,
      );
    }

    const timeBlock = await tx.timeBlock.findFirst({
      where: {
        professionalId,
        date: { gte: dayStart, lte: dayEnd },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    if (timeBlock) {
      throw new ConflictException(
        `Horário bloqueado${timeBlock.reason ? ': ' + timeBlock.reason : ''} (${timeBlock.startTime} - ${timeBlock.endTime})`,
      );
    }

    return {
      appointmentDate,
      endTime,
    };
  }

  async create(companyId: string, dto: CreateAppointmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const { appointmentDate, endTime } = await this.validateAvailability(
        tx,
        companyId,
        dto.professionalId,
        dto.serviceId,
        dto.date,
        dto.startTime,
      );

      const appointment = await tx.appointment.create({
        data: {
          companyId,
          serviceId: dto.serviceId,
          professionalId: dto.professionalId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          date: appointmentDate,
          startTime: dto.startTime,
          endTime,
          notes: dto.notes,
        },
        include: {
          service: true,
          professional: true,
        },
      });

      return this.formatAppointment(appointment);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async update(
    id: string,
    companyId: string,
    data: Partial<CreateAppointmentDto>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { id, companyId },
        include: { service: true, professional: true },
      });

      if (!appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      const serviceId = data.serviceId !== undefined ? data.serviceId : appointment.serviceId;
      const professionalId = data.professionalId !== undefined ? data.professionalId : appointment.professionalId;
      const dateInput = data.date !== undefined ? data.date : appointment.date;
      const startTime = data.startTime !== undefined ? data.startTime : appointment.startTime;

      const needsValidation =
        data.serviceId !== undefined ||
        data.professionalId !== undefined ||
        data.date !== undefined ||
        data.startTime !== undefined;

      let appointmentDate = appointment.date;
      let endTime = appointment.endTime;

      if (needsValidation) {
        const result = await this.validateAvailability(
          tx,
          companyId,
          professionalId,
          serviceId,
          dateInput,
          startTime,
          id,
        );
        appointmentDate = result.appointmentDate;
        endTime = result.endTime;
      }

      const updated = await tx.appointment.update({
        where: { id },
        data: {
          ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
          ...(data.professionalId !== undefined && { professionalId: data.professionalId }),
          ...(data.clientName !== undefined && { clientName: data.clientName }),
          ...(data.clientPhone !== undefined && { clientPhone: data.clientPhone }),
          ...(data.clientEmail !== undefined && { clientEmail: data.clientEmail }),
          ...(needsValidation && {
            date: appointmentDate,
            startTime,
            endTime,
          }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: {
          service: true,
          professional: true,
        },
      });

      return this.formatAppointment(updated);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async updateStatus(id: string, companyId: string, status: AppointmentStatus) {
    await this.getById(id, companyId);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        service: true,
        professional: true,
      },
    });

    return this.formatAppointment(updated);
  }

  async reschedule(
    id: string,
    companyId: string,
    newDate: string,
    newStartTime: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: { id, companyId },
      });

      if (!appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      const { appointmentDate, endTime } = await this.validateAvailability(
        tx,
        companyId,
        appointment.professionalId,
        appointment.serviceId,
        newDate,
        newStartTime,
        id,
      );

      const updated = await tx.appointment.update({
        where: { id },
        data: {
          date: appointmentDate,
          startTime: newStartTime,
          endTime,
        },
        include: {
          service: true,
          professional: true,
        },
      });

      return this.formatAppointment(updated);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async blockTime(companyId: string, dto: BlockTimeDto) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: dto.professionalId, companyId },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const date = new Date(dto.date);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: dto.professionalId,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
        AND: [
          { startTime: { lt: dto.endTime } },
          { endTime: { gt: dto.startTime } },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'Existe um agendamento neste horário',
      );
    }

    return this.prisma.timeBlock.create({
      data: {
        professionalId: dto.professionalId,
        date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        reason: dto.reason,
      },
    });
  }

  private getDayName(date: Date): string {
    const days = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return days[date.getUTCDay()];
  }
}
