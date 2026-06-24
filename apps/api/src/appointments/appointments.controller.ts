import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { BlockTimeDto } from './dto/block-time.dto';

@Controller('companies/:companyId/appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(
    @Param('companyId') companyId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.appointmentsService.list(companyId, {
      dateFrom,
      dateTo,
      professionalId,
      status,
      date,
    });
  }

  @Get('today')
  async listToday(@Param('companyId') companyId: string) {
    return this.appointmentsService.listToday(companyId);
  }

  @Get('week')
  async listWeek(@Param('companyId') companyId: string) {
    return this.appointmentsService.listWeek(companyId);
  }

  @Post()
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(companyId, dto);
  }

  @Post('block-time')
  async blockTime(
    @Param('companyId') companyId: string,
    @Body() dto: BlockTimeDto,
  ) {
    return this.appointmentsService.blockTime(companyId, dto);
  }

  @Patch(':id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAppointmentDto>,
  ) {
    return this.appointmentsService.update(id, companyId, dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.appointmentsService.updateStatus(
      id,
      companyId,
      status as any,
    );
  }

  @Post(':id/reschedule')
  async reschedule(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: { date: string; startTime: string },
  ) {
    return this.appointmentsService.reschedule(
      id,
      companyId,
      body.date,
      body.startTime,
    );
  }
}
