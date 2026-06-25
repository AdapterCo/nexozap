import { ForbiddenException } from '@nestjs/common';
import { CompanyAccessGuard } from './company-access.guard';

describe('CompanyAccessGuard', () => {
  const request = { params: { companyId: 'company-1' }, user: { id: 'user-1' } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;

  it('allows an existing membership', async () => {
    const prisma = { companyUser: { findUnique: jest.fn().mockResolvedValue({ id: 'membership-1' }) } } as any;
    await expect(new CompanyAccessGuard(prisma).canActivate(context)).resolves.toBe(true);
  });

  it('rejects access to another company', async () => {
    const prisma = { companyUser: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    await expect(new CompanyAccessGuard(prisma).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
