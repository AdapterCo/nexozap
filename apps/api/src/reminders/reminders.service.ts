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

    const now = new Date();
    const startRange = new Date(now);
    startRange.setDate(now.getDate() - 1);
    startRange.setHours(0, 0, 0, 0);

    const endRange = new Date(now);
    endRange.setDate(now.getDate() + 2);
    endRange.setHours(23, 59, 59, 999);

    try {
      const appointments = await this.prisma.appointment.findMany({
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED', 'COMPLETED'] },
          date: {
            gte: startRange,
            lte: endRange,
          },
        },
        include: {
          service: true,
          professional: true,
          reminders: true,
          company: {
            include: { notificationSettings: true },
          },
        },
      });

      for (const appointment of appointments) {
        const settings = appointment.company.notificationSettings;
        if (settings && !settings.isEnabled) continue;

        const d = appointment.date;
        const yyyy = d.getUTCFullYear();
        const mm = d.getUTCMonth();
        const dd = d.getUTCDate();

        const [startH, startM] = appointment.startTime.split(':').map(Number);
        // Horário de Brasília (UTC-3): soma 3 horas para obter o timestamp absoluto UTC
        const appointmentStart = new Date(Date.UTC(yyyy, mm, dd, startH + 3, startM, 0, 0));

        const [endH, endM] = appointment.endTime.split(':').map(Number);
        const appointmentEnd = new Date(Date.UTC(yyyy, mm, dd, endH + 3, endM, 0, 0));

        const diffStart = appointmentStart.getTime() - now.getTime();
        const diffEnd = now.getTime() - appointmentEnd.getTime();

        // Check 24h reminders (apenas na janela entre 23h e 25h antes do agendamento)
        if (appointment.status !== 'COMPLETED' && diffStart >= 23 * 60 * 60 * 1000 && diffStart <= 25 * 60 * 60 * 1000) {
          const has24h = appointment.reminders.some((r) => r.type === 'HOURS_24');
          if (!has24h) {
            const message = (settings?.hours24Message ||
              'Lembrete: Olá {nome}! Você tem um agendamento amanhã às {hora}. Serviço: {serviço}. Profissional: {profissional}.')
              .replace('{nome}', appointment.clientName || 'Cliente')
              .replace('{hora}', appointment.startTime)
              .replace('{serviço}', appointment.service.name)
              .replace('{profissional}', appointment.professional.name);

            await this.sendReminder(appointment.id, appointment.clientPhone, appointment.companyId, 'HOURS_24', message);
          }
        }

        // Check 2h reminders (janela entre 1h e 2.5h)
        if (appointment.status !== 'COMPLETED' && diffStart >= 60 * 60 * 1000 && diffStart <= 2.5 * 60 * 60 * 1000) {
          const has2h = appointment.reminders.some((r) => r.type === 'HOURS_2');
          if (!has2h) {
            const message = (settings?.hours2Message ||
              'Lembrete: Olá {nome}! Seu agendamento é em 2 horas às {hora}. Serviço: {serviço}. Profissional: {profissional}.')
              .replace('{nome}', appointment.clientName || 'Cliente')
              .replace('{hora}', appointment.startTime)
              .replace('{serviço}', appointment.service.name)
              .replace('{profissional}', appointment.professional.name);

            await this.sendReminder(appointment.id, appointment.clientPhone, appointment.companyId, 'HOURS_2', message);
          }
        }

        // Check AFTER_SERVICE reminders
        if (appointment.status === 'COMPLETED' && diffEnd > 0 && diffEnd <= 2.5 * 60 * 60 * 1000) {
          const hasAfter = appointment.reminders.some((r) => r.type === 'AFTER_SERVICE');
          if (!hasAfter) {
            const message = settings?.afterServiceMessage ||
              'Obrigado por nos visitar! Como foi sua experiência? Avalie de 1 a 5 estrelas.';

            await this.sendReminder(appointment.id, appointment.clientPhone, appointment.companyId, 'AFTER_SERVICE', message);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error checking reminders: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
