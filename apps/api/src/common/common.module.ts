import { Global, Module } from '@nestjs/common';
import { CompanyAccessGuard } from './guards/company-access.guard';
import { EncryptionService } from './security/encryption.service';

@Global()
@Module({
  providers: [CompanyAccessGuard, EncryptionService],
  exports: [CompanyAccessGuard, EncryptionService],
})
export class CommonModule {}
