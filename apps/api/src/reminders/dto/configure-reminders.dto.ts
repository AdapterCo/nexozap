import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ConfigureRemindersDto {
  @IsOptional()
  @IsString()
  hours24Message?: string;

  @IsOptional()
  @IsString()
  hours2Message?: string;

  @IsOptional()
  @IsString()
  afterServiceMessage?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
