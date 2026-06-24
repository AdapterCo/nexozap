import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async getByUserId(userId: string) {
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    });

    if (!companyUser) {
      throw new NotFoundException('Empresa não encontrada');
    }

    return companyUser.company;
  }

  async getById(id: string, userId: string) {
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { companyId: id, userId },
      include: { company: true },
    });

    if (!companyUser) {
      throw new NotFoundException('Empresa não encontrada');
    }

    return companyUser.company;
  }

  async findByUserId(userId: string) {
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    });

    return companyUser?.company || null;
  }

  async listByUserId(userId: string) {
    const companyUsers = await this.prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
    });

    return companyUsers.map((cu) => cu.company);
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.ownerName !== undefined && { ownerName: dto.ownerName }),
        ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.openingTime !== undefined && { openingTime: dto.openingTime }),
        ...(dto.closingTime !== undefined && { closingTime: dto.closingTime }),
        ...(dto.workingDays !== undefined && { workingDays: dto.workingDays }),
      },
    });
  }
}
