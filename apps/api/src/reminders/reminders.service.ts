import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      const message = (settings?.hours24Message ||
        'Lembrete: Você tem um agendamento amanhã às {hora}. Serviço: {serviço}. Profissional: {profissional}.')
        .replace('{hora}', appointment.startTime)
        .replace('{serviço}', appointment.service.name)
        .replace('{profissional}', appointment.professional.name);

      await this.prisma.reminder.create({
        data: {
          appointmentId: appointment.id,
          type: 'HOURS_24',
          message,
          sentAt: new Date(),
        },
      });

      this.logger.log(`24h reminder created for appointment ${appointment.id}`);
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
      const message = (settings?.hours2Message ||
        'Lembrete: Seu agendamento é em 2 horas às {hora}. Serviço: {serviço}. Profissional: {profissional}.')
        .replace('{hora}', appointment.startTime)
        .replace('{serviço}', appointment.service.name)
        .replace('{profissional}', appointment.professional.name);

      await this.prisma.reminder.create({
        data: {
          appointmentId: appointment.id,
          type: 'HOURS_2',
          message,
          sentAt: new Date(),
        },
      });

      this.logger.log(`2h reminder created for appointment ${appointment.id}`);
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
      const message =
        settings?.afterServiceMessage ||
        'Obrigado por nos visitar! Como foi sua experiência? Avalie de 1 a 5 estrelas.';

      await this.prisma.reminder.create({
        data: {
          appointmentId: appointment.id,
          type: 'AFTER_SERVICE',
          message,
          sentAt: new Date(),
        },
      });

      this.logger.log(`After-service reminder created for appointment ${appointment.id}`);
    }
  }
}
