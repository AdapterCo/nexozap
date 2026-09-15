import { Injectable, ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { Plan } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private billingService: BillingService,
    private config: ConfigService,
  ) {}

  private createRegistrationToken(paymentId: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(paymentId)
      .digest('base64url');
  }

  private assertRegistrationToken(paymentId: string, token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Token de confirmação de pagamento obrigatório');
    }
    const expected = this.createRegistrationToken(paymentId);
    if (token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new UnauthorizedException('Token de confirmação de pagamento inválido');
    }
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    plan: Plan;
    paymentMethod: 'credit_card' | 'pix';
    cardData?: any;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    if (!data.plan || !['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].includes(data.plan)) {
      throw new BadRequestException('Por favor, selecione um plano válido');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const { user, company } = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          name: data.name,
          role: 'OWNER',
        },
      });
      const company = await transaction.company.create({
        data: {
          name: data.companyName,
          ownerName: data.name,
          email: data.email,
          plan: data.plan,
          planStatus: 'PAST_DUE',
        },
      });
      await transaction.companyUser.create({
        data: { companyId: company.id, userId: user.id, role: 'OWNER' },
      });
      await transaction.notificationSettings.create({ data: { companyId: company.id } });
      return { user, company };
    });

    try {
      const payment = await this.billingService.createPayment(
        company.id,
        data.plan,
        data.paymentMethod,
        data.cardData,
      );

      if (data.paymentMethod === 'credit_card') {
        if (payment.status !== 'APPROVED') {
          await this.cleanupUnpaidAccount(user.id, company.id);
          throw new BadRequestException('Pagamento recusado. A conta só pode ser criada após aprovação do pagamento.');
        }
        const token = this.jwtService.sign({ sub: user.id, email: user.email });
        return {
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
          company: { id: company.id, name: company.name, plan: company.plan },
        };
      } else {
        // Pix pending
        return {
          paymentId: payment.id,
          registrationToken: this.createRegistrationToken(payment.id),
          qrCode: payment.qrCode,
          qrCodeBase64: payment.qrCodeBase64,
          status: 'PENDING',
          user: { id: user.id, email: user.email },
          company: { id: company.id },
        };
      }
    } catch (err) {
      await this.cleanupUnpaidAccount(user.id, company.id);
      throw err;
    }
  }

  async checkRegistrationPayment(paymentId: string, registrationToken: string | undefined) {
    this.assertRegistrationToken(paymentId, registrationToken);

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { company: { include: { users: { include: { user: true } } } } },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    const updatedPayment = await this.billingService.checkPaymentStatus(payment.companyId, paymentId);

    if (updatedPayment.status === 'APPROVED') {
      const ownerRelation = payment.company.users.find((u) => u.role === 'OWNER') || payment.company.users[0];
      const user = ownerRelation.user;
      const token = this.jwtService.sign({ sub: user.id, email: user.email });

      return {
        status: 'APPROVED',
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        company: { id: payment.company.id, name: payment.company.name, plan: updatedPayment.plan },
      };
    }

    return {
      status: updatedPayment.status,
    };
  }

  async cancelRegistrationPayment(paymentId: string, registrationToken: string | undefined) {
    this.assertRegistrationToken(paymentId, registrationToken);

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { company: { include: { users: true } } },
    });

    if (!payment) {
      return { success: true };
    }

    await this.billingService.cancelPayment(payment.companyId, paymentId);

    if (payment.status !== 'APPROVED') {
      const userId = payment.company.users[0]?.userId;
      if (userId) {
        await this.cleanupUnpaidAccount(userId, payment.companyId);
      }
    }

    return { success: true };
  }

  private async cleanupUnpaidAccount(userId: string, companyId: string) {
    try {
      await this.prisma.$transaction([
        this.prisma.payment.deleteMany({ where: { companyId } }),
        this.prisma.notificationSettings.deleteMany({ where: { companyId } }),
        this.prisma.companyUser.deleteMany({ where: { userId } }),
        this.prisma.company.delete({ where: { id: companyId } }),
        this.prisma.user.delete({ where: { id: userId } }),
      ]);
    } catch (e) {
      // Ignora erros ao limpar cadastro não finalizado
    }
  }

  async login(data: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await bcrypt.compare(data.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId: user.id },
      include: { company: true },
    });

    if (companyUser?.company?.planStatus === 'PAST_DUE' && !companyUser.company.planActivatedAt) {
      throw new UnauthorizedException('Pagamento pendente. Conclua o pagamento para ativar sua conta.');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
      company: companyUser ? { id: companyUser.company.id, name: companyUser.company.name, plan: companyUser.company.plan } : null,
    };
  }

  private createPasswordResetToken(userId: string): string {
    const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 15 * 60_000 })).toString('base64url');
    const signature = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private assertPasswordResetToken(token: string | undefined): string {
    if (!token) throw new BadRequestException('Token de redefinição obrigatório');
    const [payload, signature] = token.split('.');
    if (!payload || !signature) throw new BadRequestException('Token de redefinição inválido');
    const expected = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(payload)
      .digest('base64url');
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new BadRequestException('Token de redefinição inválido');
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { userId: string; exp: number };
    if (data.exp < Date.now()) {
      throw new BadRequestException('Token de redefinição expirado. Solicite um novo.');
    }
    return data.userId;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: true, message: 'Se o e-mail estiver cadastrado, as instruções foram geradas.' };
    }
    const resetToken = this.createPasswordResetToken(user.id);
    return {
      success: true,
      message: 'Instruções para redefinição geradas com sucesso.',
      resetToken,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('A senha deve ter pelo menos 6 caracteres');
    }
    const userId = this.assertPasswordResetToken(token);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
    return { success: true, message: 'Senha redefinida com sucesso!' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true },
    });

    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    });

    return {
      user,
      company: companyUser?.company || null,
    };
  }
}
