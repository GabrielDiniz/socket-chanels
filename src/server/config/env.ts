import 'dotenv/config';
import { z } from 'zod';


// Exportado para uso em testes
export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  NEXT_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  
  // Variáveis Atômicas
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().optional(),
  DB_PASS: z.string().optional(),
  DB_NAME: z.string().optional(),

  // DATABASE_URL final
  DATABASE_URL: z.string().url().optional(),

  API_SECRET: z.string().optional(),
  CHANNEL_REGISTRATION_KEY: z.string().min(10).default('supersecretkey12345'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  // Aqui usamos console.error direto pois o logger pode depender de envs que falharam
  console.error('❌ Variáveis de ambiente inválidas:', JSON.stringify(_env.error.format(), null, 2));
  process.exit(1);
}

// Lógica de Composição
let data = _env.data;

if (!data.DATABASE_URL) {
  if (data.DB_USER && data.DB_PASS && data.DB_HOST && data.DB_NAME) {
    data.DATABASE_URL = `mysql://${data.DB_USER}:${data.DB_PASS}@${data.DB_HOST}:${data.DB_PORT}/${data.DB_NAME}`;
  } else {
    console.error('❌ Erro Fatal: DATABASE_URL não definida e variáveis atômicas incompletas.');
    process.exit(1);
  }
}

export const env = {
  ...data,
  DATABASE_URL: data.DATABASE_URL as string, 
};