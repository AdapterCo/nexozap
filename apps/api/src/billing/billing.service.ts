import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Plan } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { createHmac, timingSafeEqual } from 'crypto';

const PIX_RENEWAL_WINDOW_DAYS = 3;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  private get mpHeaders() {
    const accessToken = this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getPlan(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const [appointmentsUsed, whatsappUsed, professionalsUsed] = await Promise.all([
      this.prisma.appointment.count({ where: { companyId } }),
      this.prisma.whatsAppConnection.count({ where: { companyId } }),
      this.prisma.professional.count({ where: { companyId } }),
    ]);

    const limits = {
      BASIC: { appointments: 500, whatsapp: 1, professionals: 2 },
      PROFESSIONAL: { appointments: 2000, whatsapp: 2, professionals: 10 },
      ENTERPRISE: { appointments: 999999, whatsapp: 999, professionals: 999 },
    };

    const currentLimits = limits[company.plan] || limits.BASIC;

    return {
      plan: company.plan,
      planStatus: company.planStatus,
      planActivatedAt: company.planActivatedAt,
      planExpiresAt: company.planExpiresAt,
      limits: {
        appointments: { used: appointmentsUsed, max: currentLimits.appointments },
        whatsapp: { used: whatsappUsed, max: currentLimits.whatsapp },
        professionals: { used: professionalsUsed, max: currentLimits.professionals },
      },
    };
  }

  async createPayment(
    companyId: string,
    plan: Plan,
    paymentMethod: 'credit_card' | 'pix',
    cardData?: {
      token: string;
      paymentMethodId: string;
      issuerId?: string;
      installments?: number;
      email?: string;
      identificationType?: string;
      identificationNumber?: string;
    },
  ) {
    const planPrices: Record<Plan, number> = {
      BASIC: 39.90,
      PROFESSIONAL: 79.90,
      ENTERPRISE: 119.90,
    };

    const amount = planPrices[plan];
    if (!amount) {
      throw new BadRequestException('Plano inválido');
    }

    if (paymentMethod === 'pix') {
      let mpPayment: any;

      try {
        const mpPayload = {
          transaction_amount: amount,
          description: `Assinatura NexoZap - Plano ${plan}`,
          payment_method_id: 'pix',
          payer: {
            email: 'cliente@nexozap.com',
            first_name: 'NexoZap',
            last_name: 'Cliente',
            identification: {
              type: 'CPF',
              number: '12345678909',
            },
          },
        };

        const response = await firstValueFrom(
          this.httpService.post('https://api.mercadopago.com/v1/payments', mpPayload, {
            headers: this.mpHeaders,
          }),
        );

        mpPayment = response.data;
      } catch (err) {
        const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message;
        this.logger.error(`Erro ao criar pagamento Pix no Mercado Pago: ${detail}`);
        throw new BadRequestException(`Erro ao gerar cobrança Pix no Mercado Pago: ${detail}`);
      }

      const payment = await this.prisma.payment.create({
        data: {
          companyId,
          plan,
          amount,
          status: 'PENDING',
          mpPaymentId: String(mpPayment.id),
          qrCode: mpPayment.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64,
        },
      });

      return payment;
    } else {
      if (!cardData?.token || !cardData?.paymentMethodId) {
        throw new BadRequestException('Dados de cartão de crédito são necessários');
      }

      // Cartão assina uma cobrança recorrente mensal (Preapproval) em vez de uma cobrança avulsa,
      // para que o plano seja renovado automaticamente todo mês pelo Mercado Pago.
      let mpPreapproval: any;

      try {
        const preapprovalPayload = {
          reason: `Assinatura NexoZap - Plano ${plan}`,
          external_reference: companyId,
          payer_email: cardData.email || 'cliente@nexozap.com',
          card_token_id: cardData.token,
          status: 'authorized',
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: amount,
            currency_id: 'BRL',
          },
        };

        const response = await firstValueFrom(
          this.httpService.post('https://api.mercadopago.com/preapproval', preapprovalPayload, {
            headers: this.mpHeaders,
          }),
        );

        mpPreapproval = response.data;
      } catch (err) {
        const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message;
        this.logger.error(`Erro ao criar assinatura de Cartão no Mercado Pago: ${detail}`);
        throw new BadRequestException(`Erro ao processar pagamento com cartão: ${detail}`);
      }

      const mpStatus = mpPreapproval.status === 'authorized' ? 'APPROVED' : mpPreapproval.status === 'cancelled' ? 'REJECTED' : 'PENDING';

      const payment = await this.prisma.payment.create({
        data: {
          companyId,
          plan,
          amount,
          status: mpStatus,
          mpPreapprovalId: mpPreapproval.id,
        },
      });

      if (mpStatus === 'APPROVED') {
        const activatedAt = new Date();
        await this.prisma.company.update({
          where: { id: companyId },
          data: {
            plan,
            planStatus: 'ACTIVE',
            planActivatedAt: activatedAt,
            planExpiresAt: this.addOneMonth(activatedAt),
            mpPreapprovalId: mpPreapproval.id,
          },
        });
        this.logger.log(`Assinatura recorrente autorizada. Plano ${plan} ativado para empresa ${companyId}.`);
      }

      if (mpStatus === 'REJECTED') {
        const reason = mpPreapproval.status_detail || 'desconhecido';
        throw new BadRequestException(`Pagamento recusado pelo emissor (${reason}). Verifique os dados do cartão.`);
      }

      return payment;
    }
  }

  private addOneMonth(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    return result;
  }

  async getPayment(companyId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    return payment;
  }

  /**
   * Consulta o status atualizado do pagamento diretamente na API do Mercado Pago,
   * persiste a atualização no banco e, se aprovado, ativa o plano da empresa.
   * Usado pelo frontend para polling ativo (sem webhook).
   */
  async checkPaymentStatus(companyId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    // Se já tem status final, retorna diretamente sem consultar o MP
    if (payment.status === 'APPROVED' || payment.status === 'REJECTED' || payment.status === 'CANCELLED') {
      return payment;
    }

    if (!payment.mpPaymentId) {
      return payment;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.mercadopago.com/v1/payments/${payment.mpPaymentId}`, {
          headers: this.mpHeaders,
        }),
      );

      const mpPayment = response.data;
      const mpStatus: string = mpPayment.status;

      const newStatus =
        mpStatus === 'approved' ? 'APPROVED' :
        mpStatus === 'rejected' ? 'REJECTED' :
        mpStatus === 'cancelled' ? 'CANCELLED' :
        'PENDING';

      if (newStatus !== payment.status) {
        const updatedPayment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: newStatus },
        });

        if (newStatus === 'APPROVED') {
          const activatedAt = new Date();
          await this.prisma.company.update({
            where: { id: companyId },
            data: {
              plan: payment.plan,
              planStatus: 'ACTIVE',
              planActivatedAt: activatedAt,
              planExpiresAt: this.addOneMonth(activatedAt),
            },
          });
          this.logger.log(`Pagamento ${payment.mpPaymentId} aprovado via polling. Plano ${payment.plan} ativado para empresa ${companyId}.`);
        }

        return updatedPayment;
      }

      return payment;
    } catch (err) {
      // Em caso de erro ao consultar o MP (ex: rate limit), retorna o status atual do DB sem falhar
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message;
      this.logger.warn(`Erro ao consultar status do pagamento ${payment.mpPaymentId} no MP: ${detail}`);
      return payment;
    }
  }

  /**
   * Cancela um pagamento pendente no Mercado Pago e atualiza o banco.
   * Chamado quando o frontend detecta timeout de 3 minutos sem confirmação.
   */
  async cancelPayment(companyId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, companyId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    if (payment.status !== 'PENDING') {
      // Já foi processado, retorna o estado atual sem erro
      return payment;
    }

    // Tenta cancelar no MP (apenas pagamentos Pix pendentes podem ser cancelados)
    if (payment.mpPaymentId && !payment.mpPaymentId.startsWith('MOCK-')) {
      try {
        await firstValueFrom(
          this.httpService.put(
            `https://api.mercadopago.com/v1/payments/${payment.mpPaymentId}`,
            { status: 'cancelled' },
            { headers: this.mpHeaders },
          ),
        );
        this.logger.log(`Pagamento ${payment.mpPaymentId} cancelado no MP por timeout.`);
      } catch (err) {
        // Ignora erros de cancelamento (o MP pode já ter expirado o pagamento)
        this.logger.warn(`Aviso ao tentar cancelar ${payment.mpPaymentId} no MP: ${err?.message}`);
      }
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELLED' },
    });

    return updatedPayment;
  }

  /**
   * Valida a assinatura enviada pelo Mercado Pago no header `x-signature`.
   * Sem o segredo configurado, apenas loga um aviso — a notificação ainda é
   * processada, mas o estado só é alterado após confirmação via GET autenticado
   * na API do MP (nunca a partir do corpo do webhook, que não é confiável sozinho).
   */
  private isValidWebhookSignature(headers: Record<string, string>, dataId: string): boolean {
    const secret = this.config.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('MERCADO_PAGO_WEBHOOK_SECRET não configurado; assinatura do webhook não verificada.');
      return true;
    }

    const signatureHeader = headers['x-signature'];
    const requestId = headers['x-request-id'];
    if (!signatureHeader) return false;

    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const [key, value] = part.split('=');
      if (key && value) parts[key.trim()] = value.trim();
    }

    const ts = parts['ts'];
    const hash = parts['v1'];
    if (!ts || !hash) return false;

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    return hash.length === expected.length && timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  }

  /**
   * Recebe as notificações do Mercado Pago. Trata apenas eventos de pagamento
   * ligados a uma assinatura recorrente (Preapproval) já conhecida — o estado
   * do pagamento é sempre reconsultado via API autenticada, nunca confiado
   * a partir do corpo da requisição.
   */
  async handleMercadoPagoWebhook(
    headers: Record<string, string>,
    query: Record<string, string>,
    body: any,
  ) {
    const type = body?.type || query?.type;
    const dataId = body?.data?.id || query?.['data.id'];

    if (!dataId) return;

    if (!this.isValidWebhookSignature(headers, String(dataId))) {
      this.logger.warn(`Webhook do Mercado Pago com assinatura inválida (data.id=${dataId}).`);
      return;
    }

    if (type === 'payment') {
      await this.processRecurringPaymentNotification(String(dataId));
    }
  }

  private async processRecurringPaymentNotification(mpPaymentId: string) {
    let mpPayment: any;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
          headers: this.mpHeaders,
        }),
      );
      mpPayment = response.data;
    } catch (err) {
      this.logger.warn(`Não foi possível consultar o pagamento ${mpPaymentId} recebido via webhook: ${err?.message}`);
      return;
    }

    const preapprovalId: string | undefined = mpPayment.preapproval_id;
    const companyId: string | undefined = mpPayment.external_reference;

    if (mpPayment.status !== 'approved' || !preapprovalId || !companyId) {
      return;
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, mpPreapprovalId: preapprovalId },
    });

    if (!company) {
      this.logger.warn(`Webhook de pagamento recorrente sem empresa correspondente (preapproval=${preapprovalId}).`);
      return;
    }

    const existing = await this.prisma.payment.findUnique({
      where: { mpPaymentId: String(mpPayment.id) },
    });
    if (existing) return;

    await this.prisma.payment.create({
      data: {
        companyId: company.id,
        plan: company.plan,
        amount: mpPayment.transaction_amount,
        status: 'APPROVED',
        mpPaymentId: String(mpPayment.id),
        mpPreapprovalId: preapprovalId,
      },
    });

    const activatedAt = new Date();
    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        planStatus: 'ACTIVE',
        planActivatedAt: activatedAt,
        planExpiresAt: this.addOneMonth(activatedAt),
      },
    });

    this.logger.log(`Renovação automática confirmada via webhook para empresa ${company.id} (preapproval ${preapprovalId}).`);
  }

  /**
   * Roda diariamente: marca como inadimplentes as empresas cujo plano venceu
   * sem renovação confirmada, e gera automaticamente uma nova cobrança Pix
   * para quem paga por Pix (que não tem cobrança recorrente automática) e
   * está próximo do vencimento.
   */
  @Cron('0 3 * * *')
  async enforcePlanExpirations() {
    const now = new Date();

    const { count } = await this.prisma.company.updateMany({
      where: { planStatus: 'ACTIVE', planExpiresAt: { lt: now } },
      data: { planStatus: 'PAST_DUE' },
    });
    if (count > 0) {
      this.logger.log(`${count} empresa(s) marcada(s) como inadimplente(s) por vencimento do plano.`);
    }

    const renewalWindowEnd = new Date(now.getTime() + PIX_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const dueSoonPixCompanies = await this.prisma.company.findMany({
      where: {
        planStatus: 'ACTIVE',
        mpPreapprovalId: null,
        planExpiresAt: { gt: now, lte: renewalWindowEnd },
      },
    });

    for (const company of dueSoonPixCompanies) {
      const alreadyPending = await this.prisma.payment.findFirst({
        where: {
          companyId: company.id,
          status: 'PENDING',
          createdAt: { gt: new Date(now.getTime() - PIX_RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
        },
      });
      if (alreadyPending) continue;

      try {
        await this.createPayment(company.id, company.plan, 'pix');
        this.logger.log(`Cobrança Pix de renovação gerada automaticamente para empresa ${company.id}.`);
      } catch (err) {
        this.logger.warn(`Falha ao gerar cobrança de renovação Pix para empresa ${company.id}: ${err?.message}`);
      }
    }
  }
}
