import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class ClientsService {
  private otpStore = new Map<string, { code: string; exp: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  private createAccessToken(appointmentId: string) {
    const payload = Buffer.from(JSON.stringify({ appointmentId, exp: Date.now() + 15 * 60_000 })).toString('base64url');
    const signature = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private assertAccessToken(token: string | undefined, appointmentId: string) {
    if (!token) throw new BadRequestException('Token de acesso obrigatório');
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new BadRequestException('Token de acesso inválido');
    const expected = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(payload)
      .digest('base64url');
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new BadRequestException('Token de acesso inválido');
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { appointmentId: string; exp: number };
    if (data.appointmentId !== appointmentId || data.exp < Date.now()) {
      throw new BadRequestException('Token de acesso inválido ou expirado');
    }
  }

  private maskName(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    return parts.map(part => {
      if (part.length <= 2) return part;
      return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
    }).join(' ');
  }

  private maskEmail(email?: string | null): string {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!user || !domain) return email;
    const maskedUser = user.length <= 2 
      ? user 
      : user[0] + '*'.repeat(user.length - 2) + user[user.length - 1];
    return `${maskedUser}@${domain}`;
  }

  private maskPhone(phone: string): string {
    if (!phone) return '';
    if (phone.length <= 4) return '****';
    return '*'.repeat(phone.length - 4) + phone.substring(phone.length - 4);
  }

  async sendOtp(phone: string) {
    if (!phone) {
      throw new BadRequestException('Número de telefone é obrigatório');
    }

    const latestAppointment = await this.prisma.appointment.findFirst({
      where: { clientPhone: phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestAppointment) {
      return { success: true };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(phone, { code, exp: Date.now() + 5 * 60_000 });

    try {
      await this.whatsappService.sendMessage(
        phone,
        `Seu código de acesso para o portal NexoZap é: *${code}* (válido por 5 minutos).`,
        latestAppointment.companyId,
      );
    } catch (error) {
      console.error('Erro ao enviar OTP via WhatsApp:', error);
    }

    return { success: true };
  }

  async findAppointmentsByPhone(phone: string, code?: string) {
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

    let verified = false;

    if (code) {
      const activeOtp = this.otpStore.get(phone);
      if (activeOtp && activeOtp.code === code && activeOtp.exp > Date.now()) {
        verified = true;
        this.otpStore.delete(phone);
      } else {
        throw new BadRequestException('Código de acesso inválido ou expirado');
      }
    }

    return appointments.map((appointment) => {
      if (verified) {
        return {
          ...appointment,
          accessToken: this.createAccessToken(appointment.id),
        };
      } else {
        return {
          id: appointment.id,
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status,
          clientName: this.maskName(appointment.clientName),
          clientPhone: this.maskPhone(appointment.clientPhone),
          clientEmail: this.maskEmail(appointment.clientEmail),
          notes: appointment.notes ? '***' : null,
          service: {
            name: appointment.service.name,
            durationMinutes: appointment.service.durationMinutes,
            price: appointment.service.price,
            color: appointment.service.color,
          },
          professional: {
            name: appointment.professional.name,
            photo: appointment.professional.photo,
            specialty: appointment.professional.specialty,
          },
          company: appointment.company,
          accessToken: null,
        };
      }
    });
  }

  async cancelAppointment(id: string, accessToken?: string) {
    this.assertAccessToken(accessToken, id);
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

  async reschedule(id: string, newDate: string, newTime: string, accessToken?: string) {
    this.assertAccessToken(accessToken, id);
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
    const dayName = days[newDateObj.getUTCDay()];

    const professional = await this.prisma.professional.findUnique({
      where: { id: appointment.professionalId },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

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

  async createEvaluation(appointmentId: string, rating: number, comment?: string, accessToken?: string) {
    this.assertAccessToken(accessToken, appointmentId);
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
