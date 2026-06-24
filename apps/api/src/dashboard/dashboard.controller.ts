import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':companyId/stats')
  async getStats(@Param('companyId') companyId: string) {
    return this.dashboardService.getStats(companyId);
  }

  @Get(':companyId/charts')
  async getCharts(@Param('companyId') companyId: string) {
    return this.dashboardService.getCharts(companyId);
  }
}
