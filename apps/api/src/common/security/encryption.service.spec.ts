import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const service = new EncryptionService(new ConfigService({ ENCRYPTION_KEY: 'ab'.repeat(32) }));

  it('encrypts and decrypts a secret', () => {
    const encrypted = service.encrypt('provider-secret');
    expect(encrypted).not.toContain('provider-secret');
    expect(service.decrypt(encrypted)).toBe('provider-secret');
  });

  it('supports legacy plaintext values during migration', () => {
    expect(service.decrypt('legacy-secret')).toBe('legacy-secret');
  });
});
