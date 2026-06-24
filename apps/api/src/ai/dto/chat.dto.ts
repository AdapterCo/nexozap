import { IsString } from 'class-validator';

export class ChatDto {
  @IsString()
  conversationId: string;

  @IsString()
  message: string;
}
