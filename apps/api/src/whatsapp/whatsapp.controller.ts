import { Controller, Post, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';

@Controller('companies/:companyId/whatsapp')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('connect')
  async connect(@Param('companyId') companyId: string) {
    return this.whatsappService.connect(companyId);
  }

  @Get('qrcode')
  async getQRCode(@Param('companyId') companyId: string) {
    return this.whatsappService.getQRCode(companyId);
  }

  @Get('status')
  async getStatus(@Param('companyId') companyId: string) {
    return this.whatsappService.getStatus(companyId);
  }

  @Delete('disconnect')
  async disconnect(@Param('companyId') companyId: string) {
    return this.whatsappService.disconnect(companyId);
  }
}
