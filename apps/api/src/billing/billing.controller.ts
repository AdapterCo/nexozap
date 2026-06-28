import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { Plan } from '@prisma/client';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get('companies/:companyId/billing/plan')
  async getPlan(@Param('companyId') companyId: string) {
    return this.billingService.getPlan(companyId);
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post('companies/:companyId/billing/create-payment')
  async createPayment(
    @Param('companyId') companyId: string,
    @Body('plan') plan: Plan,
    @Body('paymentMethod') paymentMethod: 'credit_card' | 'pix',
    @Body('cardData') cardData?: any,
  ) {
    return this.billingService.createPayment(companyId, plan, paymentMethod, cardData);
  }

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get('companies/:companyId/billing/payments/:paymentId')
  async getPayment(
    @Param('companyId') companyId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.getPayment(companyId, paymentId);
  }

  @Post('billing/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    return this.billingService.handleWebhook(body);
  }
}
