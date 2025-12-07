import { Request, Response } from 'express';
import { channelService } from '../services/channel.service';
import { logger } from '../config/logger';

export const getChannelHistory = async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const history = await channelService.getHistory(slug);

    if (!history) {
      return res.status(404).json({
        success: false,
        error: 'Canal não encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      channel: slug,
      history,
    });
  } catch (error: any) {
    logger.error('[History] Falha ao buscar histórico', { error: error.message, slug });
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar histórico',
    });
  }
};