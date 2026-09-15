import { Controller, Post, Get, Put, Body, Param, Query, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { Plan } from '@prisma/client';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * Endpoint público chamado pelo Mercado Pago quando uma cobrança da assinatura
   * recorrente é processada. Não usa guards de autenticação (o MP não tem um token
   * de usuário) — a integridade é garantida pela validação de assinatura HMAC e
   * pela reconsulta do pagamento diretamente na API do MP antes de qualquer alteração.
   */
  @SkipThrottle()
  @Post('billing/webhook/mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(
    @Headers() headers: Record<string, string>,
    @Query() query: Record<string, string>,
    @Body() body: any,
  ) {
    await this.billingService.handleMercadoPagoWebhook(headers, query, body);
    return { received: true };
  }

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

  /**
   * Consulta o status real do pagamento na API do Mercado Pago.
   * Usado pelo frontend para polling ativo após criação de uma cobrança.
   */
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get('companies/:companyId/billing/payments/:paymentId/check')
  async checkPaymentStatus(
    @Param('companyId') companyId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.checkPaymentStatus(companyId, paymentId);
  }

  /**
   * Cancela um pagamento pendente (chamado pelo frontend após timeout de 3 minutos).
   */
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Put('companies/:companyId/billing/payments/:paymentId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPayment(
    @Param('companyId') companyId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.cancelPayment(companyId, paymentId);
  }
}
