import { IsString, IsDateString, IsOptional } from 'class-validator';

export class BlockTimeDto {
  @IsString()
  professionalId: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
