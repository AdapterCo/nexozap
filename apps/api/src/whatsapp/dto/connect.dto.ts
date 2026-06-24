import { IsString } from 'class-validator';

export class ConnectDto {
  @IsString()
  companyId: string;

  @IsString()
  instanceName: string;
}
