import { IsString, IsOptional, IsArray, IsBoolean, IsObject } from 'class-validator';

export class UpdateProfessionalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsObject()
  workingHours?: Record<string, any>;

  @IsOptional()
  @IsArray()
  availableDays?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  serviceIds?: string[];
}
