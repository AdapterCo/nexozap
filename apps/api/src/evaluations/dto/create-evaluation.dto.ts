import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  appointmentId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
