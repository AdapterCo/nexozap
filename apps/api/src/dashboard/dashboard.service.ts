import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(companyId: string) {
    const now = new Date();

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [
      totalAppointments,
      todayAppointments,
      weekAppointments,
      activeConversations,
      completedCount,
      cancelledAppointments,
      completedAppointments,
      evaluationsAgg,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { companyId } }),
      this.prisma.appointment.count({
        where: {
          companyId,
          date: { gte: dayStart, lte: dayEnd },
        },
      }),
      this.prisma.appointment.count({
        where: {
          companyId,
          date: { gte: weekStart, lte: weekEnd },
        },
      }),
      this.prisma.conversation.count({
        where: { companyId, status: 'ACTIVE' },
      }),
      this.prisma.appointment.count({
        where: { companyId, status: 'COMPLETED' },
      }),
      this.prisma.appointment.count({
        where: { companyId, status: 'CANCELLED' },
      }),
      this.prisma.appointment.findMany({
        where: { companyId, status: 'COMPLETED' },
        include: { service: { select: { price: true } } },
      }),
      this.prisma.evaluation.aggregate({
        where: { appointment: { companyId } },
        _avg: { rating: true },
      }),
    ]);

    const conversionRate =
      totalAppointments > 0
        ? Math.round((completedCount / totalAppointments) * 100 * 100) / 100
        : 0;

    const totalRevenue = completedAppointments.reduce(
      (sum, a) => sum + (a.service?.price || 0),
      0,
    );

    const averageRating = evaluationsAgg._avg.rating
      ? Math.round(evaluationsAgg._avg.rating * 10) / 10
      : null;

    return {
      totalAppointments,
      todayAppointments,
      weekAppointments,
      activeConversations,
      completedAppointments: completedCount,
      cancelledAppointments,
      conversionRate,
      totalRevenue,
      averageRating,
    };
  }

  async getCharts(companyId: string) {
    const now = new Date();

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        date: { gte: thirtyDaysAgo },
      },
      include: { service: true, professional: true },
      orderBy: { date: 'asc' },
    });

    const appointmentsByDayMap = new Map<string, number>();
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      appointmentsByDayMap.set(key, 0);
    }
    appointments.forEach((a) => {
      const key = a.date.toISOString().split('T')[0];
      if (appointmentsByDayMap.has(key)) {
        appointmentsByDayMap.set(key, appointmentsByDayMap.get(key)! + 1);
      }
    });

    const appointmentsByDay = Array.from(appointmentsByDayMap.entries()).map(
      ([date, count]) => ({ date, count }),
    );

    const serviceCountMap = new Map<string, { name: string; count: number }>();
    appointments.forEach((a) => {
      const existing = serviceCountMap.get(a.serviceId);
      if (existing) {
        existing.count++;
      } else {
        serviceCountMap.set(a.serviceId, { name: a.service.name, count: 1 });
      }
    });
    const popularServices = Array.from(serviceCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const professionalCountMap = new Map<string, { name: string; count: number }>();
    appointments.forEach((a) => {
      const existing = professionalCountMap.get(a.professionalId);
      if (existing) {
        existing.count++;
      } else {
        professionalCountMap.set(a.professionalId, {
          name: a.professional.name,
          count: 1,
        });
      }
    });
    const appointmentsByProfessional = Array.from(professionalCountMap.values());

    const allAppointments = await this.prisma.appointment.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        date: { gte: sixMonthsAgo },
      },
      include: { service: { select: { price: true } } },
    });

    const revenueByMonthMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonthMap.set(key, 0);
    }
    allAppointments.forEach((a) => {
      const d = a.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (revenueByMonthMap.has(key)) {
        revenueByMonthMap.set(
          key,
          revenueByMonthMap.get(key)! + (a.service?.price || 0),
        );
      }
    });

    const revenueByMonth = Array.from(revenueByMonthMap.entries()).map(
      ([month, revenue]) => ({ month, revenue }),
    );

    return {
      appointmentsByDay,
      popularServices,
      appointmentsByProfessional,
      revenueByMonth,
    };
  }
}
