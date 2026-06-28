import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  private async validateServicesBelongToCompany(companyId: string, serviceIds?: string[]) {
    if (!serviceIds || serviceIds.length === 0) return;
    const servicesCount = await this.prisma.service.count({
      where: {
        id: { in: serviceIds },
        companyId,
      },
    });
    if (servicesCount !== serviceIds.length) {
      throw new BadRequestException('Um ou mais serviços fornecidos não pertencem a esta empresa');
    }
  }

  async list(companyId: string) {
    return this.prisma.professional.findMany({
      where: { companyId },
      include: {
        services: {
          include: { service: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, companyId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id, companyId },
      include: {
        services: {
          include: { service: true },
        },
      },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    return professional;
  }

  async create(companyId: string, dto: CreateProfessionalDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const currentCount = await this.prisma.professional.count({
      where: { companyId },
    });

    const limits = {
      BASIC: 2,
      PROFESSIONAL: 10,
      ENTERPRISE: 9999,
    };

    const limit = limits[company.plan] || 2;

    if (currentCount >= limit) {
      throw new BadRequestException(
        `Seu plano (${company.plan}) atingiu o limite máximo de ${limit} profissionais. Faça upgrade para cadastrar mais.`,
      );
    }

    const { serviceIds, ...data } = dto;
    await this.validateServicesBelongToCompany(companyId, serviceIds);

    return this.prisma.professional.create({
      data: {
        companyId,
        name: data.name,
        photo: data.photo,
        specialty: data.specialty,
        workingHours: data.workingHours ?? {},
        availableDays: data.availableDays,
        isActive: data.isActive,
        ...(serviceIds &&
          serviceIds.length > 0 && {
            services: {
              create: serviceIds.map((serviceId) => ({ serviceId })),
            },
          }),
      },
      include: {
        services: {
          include: { service: true },
        },
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateProfessionalDto) {
    await this.getById(id, companyId);

    const { serviceIds, ...data } = dto;

    if (serviceIds !== undefined) {
      await this.validateServicesBelongToCompany(companyId, serviceIds);
      await this.prisma.professionalService.deleteMany({
        where: { professionalId: id },
      });

      if (serviceIds.length > 0) {
        await this.prisma.professionalService.createMany({
          data: serviceIds.map((serviceId) => ({
            professionalId: id,
            serviceId,
          })),
        });
      }
    }

    return this.prisma.professional.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.photo !== undefined && { photo: data.photo }),
        ...(data.specialty !== undefined && { specialty: data.specialty }),
        ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
        ...(data.availableDays !== undefined && { availableDays: data.availableDays }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        services: {
          include: { service: true },
        },
      },
    });
  }

  async delete(id: string, companyId: string) {
    await this.getById(id, companyId);

    return this.prisma.professional.delete({ where: { id } });
  }

  async assignServices(id: string, companyId: string, serviceIds: string[]) {
    await this.getById(id, companyId);
    await this.validateServicesBelongToCompany(companyId, serviceIds);

    await this.prisma.professionalService.deleteMany({
      where: { professionalId: id },
    });

    if (serviceIds.length > 0) {
      await this.prisma.professionalService.createMany({
        data: serviceIds.map((serviceId) => ({
          professionalId: id,
          serviceId,
        })),
      });
    }

    return this.prisma.professional.findUnique({
      where: { id },
      include: {
        services: {
          include: { service: true },
        },
      },
    });
  }
}
