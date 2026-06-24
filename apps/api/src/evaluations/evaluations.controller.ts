import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Controller()
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('evaluations')
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.create(dto);
  }

  @Get('companies/:companyId/evaluations')
  @UseGuards(JwtAuthGuard)
  async list(@Param('companyId') companyId: string) {
    return this.evaluationsService.list(companyId);
  }

  @Get('companies/:companyId/evaluations/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Param('companyId') companyId: string) {
    return this.evaluationsService.getStats(companyId);
  }
}
