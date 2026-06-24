import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEvaluationDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: { evaluation: true },
    });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Apenas agendamentos concluídos podem ser avaliados');
    }

    if (appointment.evaluation) {
      throw new ConflictException('Este agendamento já possui uma avaliação');
    }

    return this.prisma.evaluation.create({
      data: {
        appointmentId: dto.appointmentId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        appointment: {
          include: { service: true, professional: true },
        },
      },
    });
  }

  async list(companyId: string) {
    return this.prisma.evaluation.findMany({
      where: {
        appointment: { companyId },
      },
      include: {
        appointment: {
          include: { service: true, professional: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(companyId: string) {
    const result = await this.prisma.evaluation.aggregate({
      where: {
        appointment: { companyId },
      },
      _avg: { rating: true },
      _count: true,
    });

    return {
      averageRating: result._avg.rating
        ? Math.round(result._avg.rating * 10) / 10
        : null,
      totalCount: result._count,
    };
  }
}
