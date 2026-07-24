import { Injectable, ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { Plan } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private billingService: BillingService,
  ) {}

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

  async checkRegistrationPayment(paymentId: string) {
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

  async cancelRegistrationPayment(paymentId: string) {
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

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
      company: companyUser ? { id: companyUser.company.id, name: companyUser.company.name, plan: companyUser.company.plan } : null,
    };
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
