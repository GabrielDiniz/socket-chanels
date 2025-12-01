// src/server/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  NEXT_ENABLED: z.string().default('true').transform((v) => v === 'true'),

  // DATABASE_URL é obrigatória em produção/dev com Prisma
  DATABASE_URL: z.string().url(),

  // API_SECRET agora é OPCIONAL (mantemos só por compatibilidade antiga)
  API_SECRET: z.string().optional(),
  CHANNEL_REGISTRATION_KEY: z.string().min(10).default('supersecretkey12345'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Variáveis de ambiente inválidas:');
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;