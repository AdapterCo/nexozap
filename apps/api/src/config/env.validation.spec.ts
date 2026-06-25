import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/nexozap',
    JWT_SECRET: 'a'.repeat(32),
    ENCRYPTION_KEY: 'ab'.repeat(32),
  };

  it('accepts a complete configuration', () => {
    expect(validateEnvironment({ ...valid })).toEqual(valid);
  });

  it('rejects missing secrets', () => {
    expect(() => validateEnvironment({ DATABASE_URL: valid.DATABASE_URL })).toThrow('Missing required');
  });

  it('rejects malformed encryption keys', () => {
    expect(() => validateEnvironment({ ...valid, ENCRYPTION_KEY: 'short' })).toThrow('64-character');
  });
});
