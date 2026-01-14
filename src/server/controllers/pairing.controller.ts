import { Request, Response } from 'express';
import { z } from 'zod';
import { PairingService } from '../services/pairing.service';
import { channelService } from '../services/channel.service';
import { logger } from '../config/logger';

const validateSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Código deve ser 6 dígitos'),
  channelSlug: z.string().min(3).max(50),
});

export const createPairingController = 
  (pairingService: PairingService) => async (req: Request, res: Response): Promise<void> => {
    try {
        
      const { code, channelSlug } = validateSchema.parse(req.body);

      const channel = await channelService.findBySlug(channelSlug);
      if (!channel) {
        res.status(404).json({ success: false, error: 'Canal não encontrado' });
        return;
      }

      pairingService.validateCode(code, channelSlug, channel.apiKey);

      res.status(200).json({ success: true, message: 'Pareamento realizado com sucesso' });
      
    } catch (error: any) {
      logger.warn('[Pairing] Validate failed', { error: error.message });
      if (error.message === 'Código inválido ou expirado') {
         res.status(410).json({ success: false, error: 'Código inválido ou expirado' });
         return;
      }
       res.status(500).json({ success: false, error: 'Erro interno: ' + error.message });
    }
  }


