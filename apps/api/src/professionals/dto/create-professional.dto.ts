import { IsString, IsOptional, IsArray, IsBoolean, IsObject, IsNotEmpty } from 'class-validator';

export class CreateProfessionalDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

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
