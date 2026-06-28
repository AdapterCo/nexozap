import { IsString, IsOptional, IsDateString, IsNotEmpty, IsEmail, Matches, Length } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  professionalId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  clientName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?\d{8,15}$/, { message: 'Número de telefone deve ter formato válido (ex: 5511999999999)' })
  clientPhone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  clientEmail?: string;

  @IsDateString({}, { message: 'Data deve estar no formato yyyy-mm-dd' })
  date: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Horário de início deve ser no formato HH:MM' })
  startTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
