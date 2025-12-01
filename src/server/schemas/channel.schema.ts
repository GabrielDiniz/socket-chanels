// src/server/schemas/register.schema.ts
import { z } from 'zod';

export const channelSchema = z.object({
  slug: z.string()
    .regex(/^[a-z0-9_-]+$/, 'Apenas letras minúsculas, números, _ e -')
    .min(3)
    .max(50),
  name: z.string().min(1).max(100),
  system: z.string().min(1).max(50), // ex: "NovoSGA", "VersaSaude"
  tenant: z.string().optional(),
  // Chave secreta compartilhada entre você e o integrador (configurada fora do código)
  registration_key: z.string().min(10),
});

export type channelDto = z.infer<typeof channelSchema>;