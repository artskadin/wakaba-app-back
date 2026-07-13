import { PrismaClient } from '@prisma/client';

export type DbEnv = 'dev' | 'prod';

export function parseEnv(v?: string): DbEnv {
  return v === 'prod' ? 'prod' : 'dev';
}

export function makePrisma(env: DbEnv = 'dev'): PrismaClient {
  const url =
    env === 'prod'
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV;

  if (env === 'prod' && !url) {
    throw new Error('DATABASE_URL_PROD is not set');
  }

  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}
