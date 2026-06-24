import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(companyId: string, dateFrom?: string, dateTo?: string) {
    const where: any = { companyId };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        where.date.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: { service: true, professional: true },
      orderBy: { date: 'asc' },
    });

    const totalAppointments = appointments.length;
    const completedCount = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancelledCount = appointments.filter((a) => a.status === 'CANCELLED').length;
    const noShowCount = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const conversionRate =
      totalAppointments > 0
        ? Math.round((completedCount / totalAppointments) * 100 * 100) / 100
        : 0;

    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED');
    const totalRevenue = completedAppointments.reduce(
      (sum, a) => sum + (a.service?.price || 0),
      0,
    );

    const revenueByServiceMap = new Map<string, { name: string; revenue: number; count: number }>();
    completedAppointments.forEach((a) => {
      const existing = revenueByServiceMap.get(a.serviceId);
      if (existing) {
        existing.revenue += a.service?.price || 0;
        existing.count++;
      } else {
        revenueByServiceMap.set(a.serviceId, {
          name: a.service?.name || 'Desconhecido',
          revenue: a.service?.price || 0,
          count: 1,
        });
      }
    });
    const revenueByService = Array.from(revenueByServiceMap.values());

    const revenueByProfessionalMap = new Map<string, { name: string; revenue: number; count: number }>();
    completedAppointments.forEach((a) => {
      const existing = revenueByProfessionalMap.get(a.professionalId);
      if (existing) {
        existing.revenue += a.service?.price || 0;
        existing.count++;
      } else {
        revenueByProfessionalMap.set(a.professionalId, {
          name: a.professional?.name || 'Desconhecido',
          revenue: a.service?.price || 0,
          count: 1,
        });
      }
    });
    const revenueByProfessional = Array.from(revenueByProfessionalMap.values());

    const serviceCountMap = new Map<string, { name: string; count: number }>();
    appointments.forEach((a) => {
      const existing = serviceCountMap.get(a.serviceId);
      if (existing) {
        existing.count++;
      } else {
        serviceCountMap.set(a.serviceId, {
          name: a.service?.name || 'Desconhecido',
          count: 1,
        });
      }
    });
    const popularServices = Array.from(serviceCountMap.values())
      .sort((a, b) => b.count - a.count);

    const peakHoursMap = new Map<string, number>();
    appointments.forEach((a) => {
      const hour = a.startTime.split(':')[0];
      peakHoursMap.set(hour, (peakHoursMap.get(hour) || 0) + 1);
    });
    const peakHours = Array.from(peakHoursMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    const professionalCountMap = new Map<string, { name: string; count: number }>();
    appointments.forEach((a) => {
      const existing = professionalCountMap.get(a.professionalId);
      if (existing) {
        existing.count++;
      } else {
        professionalCountMap.set(a.professionalId, {
          name: a.professional?.name || 'Desconhecido',
          count: 1,
        });
      }
    });
    const appointmentsByProfessional = Array.from(professionalCountMap.values());

    const tokenUsageWhere: any = { companyId };
    if (dateFrom || dateTo) {
      tokenUsageWhere.date = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        tokenUsageWhere.date.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        tokenUsageWhere.date.lte = to;
      }
    }

    const tokenUsageData = await this.prisma.tokenUsage.aggregate({
      where: tokenUsageWhere,
      _sum: { tokensUsed: true, cost: true },
      _count: true,
    });

    const tokenUsage = {
      totalTokens: tokenUsageData._sum.tokensUsed || 0,
      totalCost: tokenUsageData._sum.cost || 0,
      requestCount: tokenUsageData._count,
    };

    const flowConversations = await this.prisma.conversation.count({
      where: { companyId, mode: 'FLOW', status: 'ACTIVE' },
    });
    const avgTokensPerAIConversation = 1500;
    const costPerToken = 0.0000015;
    const savingsFromFlowMode = flowConversations * avgTokensPerAIConversation * costPerToken;

    return {
      totalAppointments,
      completedCount,
      cancelledCount,
      noShowCount,
      conversionRate,
      revenue: {
        total: totalRevenue,
        byService: revenueByService,
        byProfessional: revenueByProfessional,
      },
      popularServices,
      peakHours,
      appointmentsByProfessional,
      tokenUsage,
      savingsFromFlowMode: Math.round(savingsFromFlowMode * 100) / 100,
    };
  }
}
