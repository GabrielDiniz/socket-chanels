import { z } from 'zod';

export const versaSchema = z.object({
  source_system: z.string(),
  current_call: z.object({
    patient_name: z.string(),
    destination: z.string(),
    professional_name: z.string().optional(),
  }),
  // ... outros campos opcionais
});

// A biblioteca Zod ignora campos extras automaticamente (strip),
// então não precisamos declarar o JSON inteiro do SGA, apenas o que usamos.
export const sgaSchema = z.object({
  senha: z.object({ format: z.string() }),
  local: z.object({ nome: z.string() }),
  numeroLocal: z.number(),
  prioridade: z.object({ peso: z.number() }),
  usuario: z.object({ login: z.string() }).optional(),
  // Capturamos a data oficial da chamada se disponível
  dataChamada: z.string().nullable().optional(), 
});

export type VersaInput = z.infer<typeof versaSchema>;
export type SgaInput = z.infer<typeof sgaSchema>;