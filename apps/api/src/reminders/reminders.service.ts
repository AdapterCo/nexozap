import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigureRemindersDto } from './dto/configure-reminders.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private async sendReminder(appointmentId: string, phone: string, companyId: string, type: 'HOURS_24' | 'HOURS_2' | 'AFTER_SERVICE', message: string) {
    try {
      await this.whatsapp.sendMessage(phone, message, companyId);
      await this.prisma.reminder.create({
        data: { appointmentId, type, message, sentAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Failed to send ${type} reminder for appointment ${appointmentId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getConfig(companyId: string) {
    return this.prisma.notificationSettings.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });
  }

  async updateConfig(companyId: string, dto: ConfigureRemindersDto) {
    return this.prisma.notificationSettings.upsert({
      where: { companyId },
      create: { companyId, ...dto },
      update: dto,
    });
  }

  @Cron('*/30 * * * *')
  async checkReminders() {
    this.logger.debug('Checking reminders...');

    await this.checkHours24Reminders();
    await this.checkHours2Reminders();
    await this.checkAfterServiceReminders();
  }

  private async checkHours24Reminders() {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        date: {
          gte: now,
          lte: in24Hours,
        },
        reminders: {
          none: {
            type: 'HOURS_24',
          },
        },
      },
      include: {
        service: true,
        professional: true,
        company: {
          include: { notificationSettings: true },
        },
      },
    });

    for (const appointment of appointments) {
      const settings = appointment.company.notificationSettings;
      if (settings && !settings.isEnabled) continue;
      const message = (settings?.hours24Message ||
        'Lembrete: Você tem um agendamento amanhã às {hora}. Serviço: {serviço}. Profissional: {profissional}.')
        .replace('{hora}', appointment.startTime)
        .replace('{serviço}', appointment.service.name)
        .replace('{profissional}', appointment.professional.name);

      await this.sendReminder(appointment.id, appointment.clientPhone, appointment.companyId, 'HOURS_24', message);
    }
  }

  private async checkHours2Reminders() {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        date: {
          gte: now,
          lte: in2Hours,
        },
        reminders: {
          none: {
            type: 'HOURS_2',
          },
        },
      },
      include: {
        service: true,
        professional: true,
        company: {
          include: { notificationSettings: true },
        },
      },
    });

    for (const appointment of appointments) {
      const settings = appointment.company.notificationSettings;
      if (settings && !settings.isEnabled) continue;
      const message = (settings?.hours2Message ||
        'Lembrete: Seu agendamento é em 2 horas às {hora}. Serviço: {serviço}. Profissional: {profissional}.')
        .replace('{hora}', appointment.startTime)
        .replace('{serviço}', appointment.service.name)
        .replace('{profissional}', appointment.professional.name);

      await this.sendReminder(appointment.id, appointment.clientPhone, appointment.companyId, 'HOURS_2', message);
    }
  }

  private async checkAfterServiceReminders() {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'COMPLETED',
        date: {
          lte: now,
          gte: twoHoursAgo,
        },
        reminders: {
          none: {
            type: 'AFTER_SERVICE',
          },
        },
      },
      include: {
        service: true,
        company: {
          include: { notificationSettings: true },
        },
      },
    });

    for (const appointment of appointments) {
      const settings = appointment.company.notificationSettings;
      if (settings && !settings.isEnabled) continue;
      const message =
        settings?.afterServiceMessage ||
        'Obrigado por nos visitar! Como foi sua experiência? Avalie de 1 a 5 estrelas.';

      await this.sendReminder(appointment.id, appointment.clientPhone, appointment.companyId, 'AFTER_SERVICE', message);
    }
  }
}
