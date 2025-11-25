import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { PayloadFactory } from '../adapters/payload.factory';
import { SocketService } from '../services/socket.service';

// Middleware de Auth (Extraído para função pura)
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-auth-token'];
  const channel = req.headers['x-channel-id'];

  if (token !== env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token inválido' });
  }
  
  if (!channel || Array.isArray(channel)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Channel ID header é obrigatório' });
  }

  // Anexa o canal à request (Estender types do Express seria ideal aqui)
  (req as any).channelId = channel;
  next();
};

// Controller Factory (Injeção de Dependência do SocketService)
export const createIngestController = (socketService: SocketService) => {
  return async (req: Request, res: Response) => {
    try {
      const channelId = (req as any).channelId;
      const rawPayload = req.body;

      // 1. Adapter: Normaliza os dados (Clean Code: Complexidade escondida na Factory)
      const normalizedCall = PayloadFactory.create(rawPayload);

      // 2. Service: Executa o efeito colateral (Broadcast)
      socketService.broadcastCall(channelId, normalizedCall);

      console.info(`[Ingest] Chamada processada para ${channelId}: ${normalizedCall.name}`);

      return res.status(200).json({
        success: true,
        data: normalizedCall
      });

    } catch (error: any) {
      console.error('[Ingest Error]', error);
      
      // Tratamento de erro (Zod errors ou erros de negócio)
      const status = error.name === 'ZodError' ? 422 : 400;
      return res.status(status).json({
        success: false,
        error: error.message
      });
    }
  };
};