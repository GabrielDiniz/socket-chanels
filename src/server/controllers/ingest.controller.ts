import { Request, Response, NextFunction } from 'express';
import { PayloadFactory } from '../adapters/payload.factory';
import { SocketService } from '../services/socket.service';
import { channelService } from '../services/channel.service';
import { prisma } from '../config/prisma';
import { CallEntity } from '../domain/call.entity';
import { logger } from '../config/logger'; // Importa o logger

// -------------------------------------------------------------------
// 1. Middleware de autenticação por canal (API Key + slug)
// -------------------------------------------------------------------
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const apiKey = req.headers['x-auth-token'] as string;
  const channelSlug = req.headers['x-channel-id'] as string;

  if (!apiKey || !channelSlug) {
    logger.warn('[Auth] Tentativa de acesso sem headers obrigatórios', { ip: req.ip });
    res.status(400).json({
      error: 'Bad Request',
      message: 'Headers x-auth-token e x-channel-id são obrigatórios',
    });
    return;
  }

  try {
    const channel = await channelService.findByApiKeyAndSlug(apiKey, channelSlug);

    if (!channel) {
      logger.warn(`[Auth] Falha de autenticação: Slug=${channelSlug}`, { ip: req.ip });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token ou canal inválido ou inativo',
      });
      return;
    }

    (req as any).channel = channel;
    next();
  } catch (err) {
    logger.error('[Auth] Erro inesperado no middleware', { error: err });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// -------------------------------------------------------------------
// 2. Controller principal
// -------------------------------------------------------------------
export const createIngestController = 
  (socketService: SocketService) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const channel = (req as any).channel;
      const rawPayload = req.body;

      const normalizedCall: CallEntity = PayloadFactory.create(rawPayload);

      const savedCall = await prisma.call.create({
        data: {
          channelId: channel.id,
          patientName: normalizedCall.name,
          destination: normalizedCall.destination,
          professional: normalizedCall.professional ?? null,
          ticket: normalizedCall.rawSource === 'NovoSGA' ? normalizedCall.name : null,
          isPriority: normalizedCall.isPriority,
          sourceSystem: normalizedCall.rawSource,
          rawPayload: rawPayload as any,
        },
      });

      socketService.broadcastCall(channel.slug, {
        ...normalizedCall,
        id: savedCall.id,
      });

      // Log estruturado com metadados úteis para análise de tráfego
      logger.info('Chamada processada', {
        channel: channel.slug,
        patient: normalizedCall.name,
        system: normalizedCall.rawSource,
        priority: normalizedCall.isPriority
      });

      res.status(200).json({
        success: true,
        data: {
          id: savedCall.id,
          channel: channel.slug,
          call: normalizedCall,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        logger.warn('[Ingest] Payload inválido', { errors: error.errors, channel: (req as any).channel?.slug });
        res.status(422).json({
          success: false,
          error: 'Payload inválido',
          details: error.errors,
        });
        return;
      }

      logger.error('[Ingest] Erro de processamento', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao processar chamada',
      });
    }
  };