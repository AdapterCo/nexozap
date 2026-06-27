import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async list(companyId: string, isActive?: boolean) {
    return this.prisma.service.findMany({
      where: {
        companyId,
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, companyId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, companyId },
    });

    if (!service) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return service;
  }

  async create(companyId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        color: dto.color,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateServiceDto) {
    await this.getById(id, companyId);

    return this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);

    return this.prisma.service.delete({ where: { id } });
  }

  async toggleActive(id: string, companyId: string) {
    const service = await this.getById(id, companyId);

    return this.prisma.service.update({
      where: { id },
      data: { isActive: !service.isActive },
    });
  }
}
