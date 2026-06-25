import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.params?.companyId;
    const userId = request.user?.id;

    if (!companyId || !userId) {
      throw new ForbiddenException('Empresa não informada ou usuário não autenticado');
    }

    const membership = await this.prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('Você não possui acesso a esta empresa');
    }

    return true;
  }
}
