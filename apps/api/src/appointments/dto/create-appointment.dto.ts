import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  serviceId: string;

  @IsString()
  professionalId: string;

  @IsString()
  clientName: string;

  @IsString()
  clientPhone: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
