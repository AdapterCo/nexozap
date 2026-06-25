import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateFlowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  nodes: any[];

  @IsArray()
  edges: any[];
}
