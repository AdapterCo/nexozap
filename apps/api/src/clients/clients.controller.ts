import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { ClientsService } from './clients.service';

class SendOtpDto {
  @IsString()
  @MinLength(8)
  phone: string;
}

class RescheduleDto {
  @IsString()
  newDate: string;

  @IsString()
  newTime: string;

  @IsString()
  accessToken: string;
}

class CreateEvaluationDto {
  @IsString()
  appointmentId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  accessToken: string;
}

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.clientsService.sendOtp(dto.phone);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Get('appointments')
  async findAppointments(
    @Query('phone') phone: string,
    @Query('code') code?: string,
  ) {
    return this.clientsService.findAppointmentsByPhone(phone, code);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('appointments/:id')
  async findAppointmentById(
    @Param('id') id: string,
    @Query('accessToken') accessToken?: string,
  ) {
    return this.clientsService.findAppointmentById(id, accessToken);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('appointments/:id/slots')
  async getAvailableSlots(
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('accessToken') accessToken?: string,
  ) {
    return this.clientsService.getAvailableSlots(id, date, accessToken);
  }

  @Post('appointments/:id/cancel')
  async cancelAppointment(@Param('id') id: string, @Body('accessToken') accessToken: string) {
    return this.clientsService.cancelAppointment(id, accessToken);
  }

  @Post('appointments/:id/reschedule')
  async reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.clientsService.reschedule(id, dto.newDate, dto.newTime, dto.accessToken);
  }

  @Post('evaluate')
  async createEvaluation(@Body() dto: CreateEvaluationDto) {
    return this.clientsService.createEvaluation(
      dto.appointmentId,
      dto.rating,
      dto.comment,
      dto.accessToken,
    );
  }
}
