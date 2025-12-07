import 'dotenv/config';
import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  NEXT_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  
  // Variáveis Atômicas (Opcionais se DATABASE_URL já vier pronta)
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().optional(),
  DB_PASS: z.string().optional(),
  DB_NAME: z.string().optional(),

  // DATABASE_URL final (pode ser montada ou vir pronta)
  DATABASE_URL: z.string().url().optional(),

  API_SECRET: z.string().optional(),
  CHANNEL_REGISTRATION_KEY: z.string().min(10).default('supersecretkey12345'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Variáveis de ambiente inválidas:', _env.error.format());
  process.exit(1);
}

// Lógica de Composição (Fallback para Dev Local)
let data = _env.data;

if (!data.DATABASE_URL) {
  // Se não veio pronta (ex: fora do Docker), tentamos montar
  if (data.DB_USER && data.DB_PASS && data.DB_HOST && data.DB_NAME) {
    data.DATABASE_URL = `mysql://${data.DB_USER}:${data.DB_PASS}@${data.DB_HOST}:${data.DB_PORT}/${data.DB_NAME}`;
  } else {
    // Se faltar peças e não tiver URL, erro fatal
    console.error('Erro Fatal: DATABASE_URL não definida e variáveis atômicas (DB_USER, etc) incompletas.');
    process.exit(1);
  }
}

// Garantimos que a exportação final tenha DATABASE_URL obrigatória
export const env = {
  ...data,
  DATABASE_URL: data.DATABASE_URL as string, 
};