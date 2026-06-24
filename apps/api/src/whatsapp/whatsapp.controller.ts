import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { ConnectDto } from './dto/connect.dto';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('connect')
  async connect(@Body() dto: ConnectDto) {
    return this.whatsappService.connect(dto.companyId, dto.instanceName);
  }

  @Get('qrcode/:companyId')
  async getQRCode(@Param('companyId') companyId: string) {
    return this.whatsappService.getQRCode(companyId);
  }

  @Get('status/:companyId')
  async getStatus(@Param('companyId') companyId: string) {
    return this.whatsappService.getStatus(companyId);
  }

  @Delete('disconnect/:companyId')
  async disconnect(@Param('companyId') companyId: string) {
    return this.whatsappService.disconnect(companyId);
  }

  @Post('webhook')
  async webhook(@Body() data: any) {
    return this.whatsappService.handleIncomingMessage(data);
  }
}
