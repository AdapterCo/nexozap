import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('appointments')
  async findAppointments(@Query('phone') phone: string) {
    return this.clientsService.findAppointmentsByPhone(phone);
  }

  @Post('appointments/:id/cancel')
  async cancelAppointment(@Param('id') id: string) {
    return this.clientsService.cancelAppointment(id);
  }

  @Post('appointments/:id/reschedule')
  async reschedule(
    @Param('id') id: string,
    @Body() body: { newDate: string; newTime: string },
  ) {
    return this.clientsService.reschedule(id, body.newDate, body.newTime);
  }

  @Post('evaluate')
  async createEvaluation(
    @Body() body: { appointmentId: string; rating: number; comment?: string },
  ) {
    return this.clientsService.createEvaluation(
      body.appointmentId,
      body.rating,
      body.comment,
    );
  }
}
