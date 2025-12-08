import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';

const SYSTEM_API_KEY = env.API_SECRET; // Reutilizando a chave mestra como Admin Key por enquanto

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const adminKey = req.headers['x-admin-key'] as string;

  if (!adminKey) {
    logger.warn('[AdminAuth] Tentativa de acesso sem chave de admin', { ip: req.ip });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Header x-admin-key é obrigatório',
    });
    return;
  }

  if (adminKey !== SYSTEM_API_KEY) {
    logger.warn('[AdminAuth] Chave de admin inválida', { ip: req.ip });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Acesso negado',
    });
    return;
  }

  next();
};