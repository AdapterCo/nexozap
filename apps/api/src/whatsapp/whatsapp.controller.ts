import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('connect')
  async connect(@Body() body: { companyId: string }) {
    return this.whatsappService.connect(body.companyId);
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
}
