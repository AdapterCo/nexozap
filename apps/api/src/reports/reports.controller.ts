import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { ReportsService } from './reports.service';

@Controller('companies/:companyId/reports')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getReport(
    @Param('companyId') companyId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reportsService.getReport(companyId, dateFrom, dateTo);
  }
}
