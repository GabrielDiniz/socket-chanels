import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  var prisma: PrismaClient | undefined;
}

const logConfig = ['error'];

if (process.env.NODE_ENV !== 'production') {
    const logConfig = ['query', 'info', 'warn', 'error'] ;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: logConfig as any[],
  });


if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}