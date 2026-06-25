import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: { email: string; password: string; name: string; companyName: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
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
        },
      });
      await transaction.companyUser.create({
        data: { companyId: company.id, userId: user.id, role: 'OWNER' },
      });
      await transaction.notificationSettings.create({ data: { companyId: company.id } });
      return { user, company };
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      company: { id: company.id, name: company.name, plan: company.plan },
    };
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
