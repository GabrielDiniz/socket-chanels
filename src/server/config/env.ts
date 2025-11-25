import 'dotenv/config'; // <--- ADICIONE ESTA LINHA NO TOPO
import { z } from 'zod';

// Validação estrita das variáveis de ambiente na inicialização
const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_SECRET: z.string().min(1, "API_SECRET é obrigatória para segurança"),
  CORS_ORIGIN: z.string().default('*'),
  // Flag para desativar o frontend Next.js durante testes de backend
  NEXT_ENABLED: z.string().default('true').transform((v) => v === 'true'),
});

// Parseia process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Erro nas variáveis de ambiente:", _env.error.format());
  throw new Error("Variáveis de ambiente inválidas.");
}

export const env = _env.data;