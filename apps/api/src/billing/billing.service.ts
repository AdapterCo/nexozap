import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Plan } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

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
      BASIC: 1.00,
      PROFESSIONAL: 1.50,
      ENTERPRISE: 2.00,
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

      let mpPayment: any;

      try {
        const mpPayload = {
          transaction_amount: amount,
          token: cardData.token,
          description: `Assinatura NexoZap - Plano ${plan}`,
          installments: cardData.installments || 1,
          payment_method_id: cardData.paymentMethodId,
          issuer_id: cardData.issuerId ? Number(cardData.issuerId) : undefined,
          payer: {
            email: cardData.email || 'cliente@nexozap.com',
            identification: {
              type: cardData.identificationType || 'CPF',
              number: cardData.identificationNumber || '12345678909',
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
        this.logger.error(`Erro ao criar pagamento de Cartão no Mercado Pago: ${detail}`);
        throw new BadRequestException(`Erro ao processar pagamento com cartão: ${detail}`);
      }

      const mpStatus = mpPayment.status === 'approved' ? 'APPROVED' : mpPayment.status === 'rejected' ? 'REJECTED' : 'PENDING';

      const payment = await this.prisma.payment.create({
        data: {
          companyId,
          plan,
          amount,
          status: mpStatus,
          mpPaymentId: String(mpPayment.id),
        },
      });

      if (mpStatus === 'APPROVED') {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { plan },
        });
        this.logger.log(`Cartão aprovado imediatamente. Plano ${plan} ativado para empresa ${companyId}.`);
      }

      if (mpStatus === 'REJECTED') {
        const reason = mpPayment.status_detail || 'desconhecido';
        throw new BadRequestException(`Pagamento recusado pelo emissor (${reason}). Verifique os dados do cartão.`);
      }

      return payment;
    }
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
          await this.prisma.company.update({
            where: { id: companyId },
            data: { plan: payment.plan },
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
}
