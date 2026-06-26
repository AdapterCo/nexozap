import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(companyId: string, dateFrom?: string, dateTo?: string) {
    const { appointmentWhere, usageWhere, from, to } = this.buildPeriodFilters(
      companyId,
      dateFrom,
      dateTo,
    );

    const [appointments, tokenUsageRows, tokenUsageData] = await Promise.all([
      this.prisma.appointment.findMany({
        where: appointmentWhere,
        include: { service: true, professional: true, evaluation: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.tokenUsage.findMany({
        where: usageWhere,
        orderBy: { date: 'asc' },
      }),
      this.prisma.tokenUsage.aggregate({
        where: usageWhere,
        _sum: { tokensUsed: true, cost: true },
        _count: true,
      }),
    ]);

    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED');
    const completed = completedAppointments.length;
    const canceled = appointments.filter((a) => a.status === 'CANCELLED').length;
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const conversionRate =
      totalAppointments > 0 ? Math.round((completed / totalAppointments) * 10000) / 100 : 0;

    const totalRevenue = completedAppointments.reduce((sum, a) => sum + (a.service?.price || 0), 0);
    const ratings = appointments
      .map((a) => a.evaluation?.rating)
      .filter((rating): rating is number => typeof rating === 'number');
    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
        : 0;

    const services = this.buildServiceRows(appointments);
    const professionals = this.buildProfessionalRows(appointments);
    const byService = services.map((service) => ({ name: service.name, revenue: service.revenue }));
    const byProfessional = professionals.map((professional) => ({
      name: professional.name,
      revenue: professional.revenue,
    }));
    const dailyTrend = this.buildDailyRevenueTrend(completedAppointments, from, to);
    const totalTokens = tokenUsageData._sum.tokensUsed || 0;
    const totalCost = tokenUsageData._sum.cost || 0;
    const aiTrend = this.buildTokenTrend(tokenUsageRows, from, to);

    return {
      totalAppointments,
      completed,
      completedCount: completed,
      canceled,
      cancelledCount: canceled,
      noShow,
      noShowCount: noShow,
      conversionRate,
      revenue: totalRevenue,
      averageRating,
      statusBreakdown: [
        { name: 'Concluídos', value: completed },
        { name: 'Cancelados', value: canceled },
        { name: 'Não compareceu', value: noShow },
      ].filter((item) => item.value > 0),
      services,
      professionals,
      totalRevenue,
      byService,
      byProfessional,
      dailyTrend,
      averageTicket: completed > 0 ? totalRevenue / completed : 0,
      dailyTokens: aiTrend.todayTokens,
      monthlyTokens: aiTrend.monthTokens,
      aiTokens: totalTokens,
      flowTokens: 0,
      estimatedSavings: 0,
      costBreakdown: totalCost > 0 ? [{ label: 'Uso de IA', value: totalCost }] : [],
      trend: aiTrend.trend,
      tokenUsage: {
        totalTokens,
        totalCost,
        requestCount: tokenUsageData._count,
      },
      peakHours: this.buildPeakHours(appointments),
      appointmentsByProfessional: professionals.map((professional) => ({
        name: professional.name,
        count: professional.appointments,
      })),
      popularServices: services.map((service) => ({
        name: service.name,
        count: service.appointments,
      })),
      savingsFromFlowMode: 0,
    };
  }

  private buildPeriodFilters(companyId: string, dateFrom?: string, dateTo?: string) {
    const appointmentWhere: any = { companyId };
    const usageWhere: any = { companyId };
    const from = dateFrom ? this.startOfDay(new Date(dateFrom)) : this.startOfDay(this.daysAgo(30));
    const to = dateTo ? this.endOfDay(new Date(dateTo)) : this.endOfDay(new Date());

    appointmentWhere.date = { gte: from, lte: to };
    usageWhere.date = { gte: from, lte: to };

    return { appointmentWhere, usageWhere, from, to };
  }

  private buildServiceRows(appointments: any[]) {
    const rows = new Map<
      string,
      { name: string; appointments: number; revenue: number; ratingSum: number; ratingCount: number }
    >();

    appointments.forEach((appointment) => {
      const key = appointment.serviceId;
      const existing =
        rows.get(key) ||
        {
          name: appointment.service?.name || 'Serviço removido',
          appointments: 0,
          revenue: 0,
          ratingSum: 0,
          ratingCount: 0,
        };

      existing.appointments++;
      if (appointment.status === 'COMPLETED') {
        existing.revenue += appointment.service?.price || 0;
      }
      if (appointment.evaluation?.rating) {
        existing.ratingSum += appointment.evaluation.rating;
        existing.ratingCount++;
      }

      rows.set(key, existing);
    });

    return Array.from(rows.values())
      .map(({ ratingSum, ratingCount, ...row }) => ({
        ...row,
        averageRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.appointments - a.appointments);
  }

  private buildProfessionalRows(appointments: any[]) {
    const rows = new Map<
      string,
      { name: string; appointments: number; revenue: number; ratingSum: number; ratingCount: number }
    >();

    appointments.forEach((appointment) => {
      const key = appointment.professionalId;
      const existing =
        rows.get(key) ||
        {
          name: appointment.professional?.name || 'Profissional removido',
          appointments: 0,
          revenue: 0,
          ratingSum: 0,
          ratingCount: 0,
        };

      existing.appointments++;
      if (appointment.status === 'COMPLETED') {
        existing.revenue += appointment.service?.price || 0;
      }
      if (appointment.evaluation?.rating) {
        existing.ratingSum += appointment.evaluation.rating;
        existing.ratingCount++;
      }

      rows.set(key, existing);
    });

    return Array.from(rows.values())
      .map(({ ratingSum, ratingCount, ...row }) => ({
        ...row,
        rating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.appointments - a.appointments);
  }

  private buildDailyRevenueTrend(appointments: any[], from: Date, to: Date) {
    const days = this.buildDayMap(from, to);

    appointments.forEach((appointment) => {
      const key = appointment.date.toISOString().slice(0, 10);
      days.set(key, (days.get(key) || 0) + (appointment.service?.price || 0));
    });

    return Array.from(days.entries()).map(([date, revenue]) => ({
      date: this.formatDateLabel(date),
      revenue,
    }));
  }

  private buildTokenTrend(tokenUsageRows: any[], from: Date, to: Date) {
    const days = this.buildDayMap(from, to);
    const todayKey = new Date().toISOString().slice(0, 10);
    const monthKey = new Date().toISOString().slice(0, 7);
    let todayTokens = 0;
    let monthTokens = 0;

    tokenUsageRows.forEach((row) => {
      const key = row.date.toISOString().slice(0, 10);
      const tokens = row.tokensUsed || 0;
      days.set(key, (days.get(key) || 0) + tokens);
      if (key === todayKey) todayTokens += tokens;
      if (key.startsWith(monthKey)) monthTokens += tokens;
    });

    return {
      todayTokens,
      monthTokens,
      trend: Array.from(days.entries()).map(([date, tokens]) => ({
        date: this.formatDateLabel(date),
        ai: tokens,
        flow: 0,
      })),
    };
  }

  private buildPeakHours(appointments: any[]) {
    const peakHoursMap = new Map<string, number>();
    appointments.forEach((appointment) => {
      const hour = appointment.startTime.split(':')[0];
      peakHoursMap.set(hour, (peakHoursMap.get(hour) || 0) + 1);
    });

    return Array.from(peakHoursMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  private buildDayMap(from: Date, to: Date) {
    const days = new Map<string, number>();
    const cursor = this.startOfDay(new Date(from));
    const end = this.startOfDay(new Date(to));

    while (cursor <= end) {
      days.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  private formatDateLabel(date: string) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year.slice(2)}`;
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
