const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  if (!/^[a-fA-F0-9]{64}$/.test(String(config.ENCRYPTION_KEY))) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal key');
  }

  return config;
}
