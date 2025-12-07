import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  var prisma: PrismaClient | undefined;
}

const logConfig = process.env.NODE_ENV === 'development' 
  ? ['query', 'info', 'warn', 'error'] 
  : ['error'];

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: logConfig as any[],
  });


if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}