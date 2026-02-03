import { cli } from 'cypress';
import { z } from 'zod';

export const versaSchema = z.object({
  source_system: z.string(),
  current_call: z.object({
    patient_name: z.string(),
    destination: z.string(),
    professional_name: z.string().optional(),
    sector_id: z.union([z.string(), z.number()]).optional(),
  }),
});

export const sgaSchema = z.object({
  senha: z.object({ format: z.string() }),
  local: z.object({ 
    id: z.number().optional(),
    nome: z.string() 
  }),
  servico: z.object({
    id: z.number().optional(),
    nome: z.string().optional(),
  }).optional(),
  numeroLocal: z.number(),
  prioridade: z.object({ peso: z.number() }),
  usuario: z.object({ login: z.string() }).optional(),
  dataChamada: z.string().nullable().optional(), 
  cliente: z.object({ nome: z.string()  }).optional().nullable(),
});

export type VersaInput = z.infer<typeof versaSchema>;
export type SgaInput = z.infer<typeof sgaSchema>;