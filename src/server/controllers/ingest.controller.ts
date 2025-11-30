// src/server/controllers/ingest.controller.ts
import { Request, Response, NextFunction } from 'express';
import { PayloadFactory } from '../adapters/payload.factory';
import { SocketService } from '../services/socket.service';
import { channelService } from '../services/channel.service';
import { prisma } from '../config/prisma';
import { CallEntity } from '../domain/call.entity';

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
    res.status(400).json({
      error: 'Bad Request',
      message: 'Headers x-auth-token e x-channel-id são obrigatórios',
    });
    return;
  }

  try {
    const channel = await channelService.findByApiKeyAndSlug(apiKey, channelSlug);

    if (!channel) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token ou canal inválido ou inativo',
      });
      return;
    }

    // Anexa o registro completo do canal à request (evita consultas repetidas)
    (req as any).channel = channel;
    next();
  } catch (err) {
    console.error('[AuthMiddleware] Erro inesperado:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// -------------------------------------------------------------------
// 2. Controller principal – fábrica com injeção do SocketService
// -------------------------------------------------------------------
export const createIngestController =
  (socketService: SocketService) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Canal já validado e anexado pelo middleware
      const channel = (req as any).channel;
      const rawPayload = req.body;

      // ----------------------------------------------------------------
      // Normalização do payload (Strategy + Zod)
      // ----------------------------------------------------------------
      const normalizedCall: CallEntity = PayloadFactory.create(rawPayload);

      // ----------------------------------------------------------------
      // Persistência da chamada (histórico + auditoria)
      // ----------------------------------------------------------------
      const savedCall = await prisma.call.create({
        data: {
          channelId: channel.id,
          patientName: normalizedCall.name,
          destination: normalizedCall.destination,
          professional: normalizedCall.professional ?? null,
          ticket:
            normalizedCall.rawSource === 'NovoSGA' ? normalizedCall.name : null,
          isPriority: normalizedCall.isPriority,
          sourceSystem: normalizedCall.rawSource,
          rawPayload: rawPayload as any, // Json do Prisma aceita objeto puro
        },
      });

      // ----------------------------------------------------------------
      // Broadcast em tempo real para todos os clientes na room (slug)
      // ----------------------------------------------------------------
      socketService.broadcastCall(channel.slug, {
        ...normalizedCall,
        id: savedCall.id, // garante ID único (cuid) no frontend também
      });

      console.info(
        `[Ingest] Canal "${channel.slug}" (${channel.name}) → ${normalizedCall.name} → ${normalizedCall.destination}`
      );

      // ----------------------------------------------------------------
      // Resposta de sucesso
      // ----------------------------------------------------------------
      res.status(200).json({
        success: true,
        data: {
          id: savedCall.id,
          channel: channel.slug,
          call: normalizedCall,
        },
      });
    } catch (error: any) {
      console.error('[IngestController] Erro:', error);

      // Erros de validação Zod → 422 Unprocessable Entity
      if (error.name === 'ZodError') {
        res.status(422).json({
          success: false,
          error: 'Payload inválido',
          details: error.errors,
        });
        return;
      }

      // Erro genérico de negócio ou estratégia desconhecida
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao processar chamada',
      });
    }
  };