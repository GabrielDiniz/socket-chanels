import { Request, Response, NextFunction } from 'express';
import { PayloadFactory } from '../adapters/payload.factory';
import { SocketService } from '../services/socket.service';
import { channelService } from '../services/channel.service';
import { prisma } from '../config/prisma';
import { CallEntity } from '../domain/call.entity';
import { logger } from '../config/logger';

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
    // Busca o canal e INCLUI o tenant para verificar status
    const channel = await channelService.findByApiKeyAndSlug(apiKey, channelSlug);

    if (!channel) {
      logger.warn(`[Auth] Falha de autenticação: Slug=${channelSlug}`, { ip: req.ip });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token ou canal inválido ou inativo',
      });
      return;
    }

    // KILL SWITCH: Verifica se o Tenant dono do canal está ativo
    if (channel.tenant && !channel.tenant.isActive) {
      logger.warn(`[Auth] Acesso negado: Tenant inativo (Slug=${channelSlug})`, { 
        tenant: channel.tenant.name,
        ip: req.ip 
      });
      res.status(403).json({ // 403 Forbidden é mais semântico para "autenticado mas bloqueado"
        error: 'Forbidden',
        message: 'Acesso suspenso para este contratante',
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

      // 1. Normalização (Pode lançar ZodError ou Error genérico de formato)
      const normalizedCall: CallEntity = PayloadFactory.create(rawPayload);

      // 2. Persistência (Pode lançar erro do Prisma/DB)
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

      // 3. Broadcast
      socketService.broadcastCall(channel.slug, {
        ...normalizedCall,
        id: savedCall.id,
      });

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
      // Caso 1: Erro de Validação do Zod (422)
      if (error.name === 'ZodError') {
        logger.warn('[Ingest] Payload inválido', { errors: error.errors, channel: (req as any).channel });
        res.status(422).json({
          success: false,
          error: 'Payload inválido',
          details: error.errors,
        });
        return;
      }

      // Caso 2: Payload desconhecido (regra de negócio da Factory) (400)
      if (error.message === 'Formato de payload desconhecido ou não suportado.') {
         logger.warn('[Ingest] Formato desconhecido', { error: error.message });
         res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      // Caso 3: Erro interno (Banco de dados, Socket, etc) (500)
      logger.error('[Ingest] Erro de processamento', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Erro interno ao processar chamada',
      });
    }
  };