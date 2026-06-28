import { IsString, IsOptional, IsNumber, IsBoolean, IsNotEmpty, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do serviço é obrigatório' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Duração deve ser de no mínimo 1 minuto' })
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Preço não pode ser negativo' })
  price?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
