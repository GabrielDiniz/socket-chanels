import { z } from 'zod';

export const channelSchema = z.object({
  slug: z.string()
    .regex(/^[a-z0-9_-]+$/, 'Apenas letras minúsculas, números, _ e -')
    .min(3)
    .max(50),
  name: z.string().min(1).max(100),
  // Removido 'system' pois agora usamos tenantId
  tenantId: z.string().optional(), 
  
  // Chave secreta compartilhada
  registration_key: z.string().min(10),
});

export type channelDto = z.infer<typeof channelSchema>;