import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Controller()
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('companies/:companyId/evaluations')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async create(@Param('companyId') companyId: string, @Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.create(dto, companyId);
  }

  @Get('companies/:companyId/evaluations')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async list(@Param('companyId') companyId: string) {
    return this.evaluationsService.list(companyId);
  }

  @Get('companies/:companyId/evaluations/stats')
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  async getStats(@Param('companyId') companyId: string) {
    return this.evaluationsService.getStats(companyId);
  }
}
