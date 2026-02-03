import { Request, Response, NextFunction } from 'express';
import { PayloadFactory } from '../adapters/payload.factory';
import { SocketService } from '../services/socket.service';
import { channelService } from '../services/channel.service';
import { channelRouter } from '../services/channel.router';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

/**
 * Middleware de Autenticação Híbrido
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['x-auth-token'] as string;
    const channelHeader = req.headers['x-channel-id'] as string;
    const tenantKeyHeader = req.headers['x-tenant-key'] as string;

    // --- ESTRATÉGIA 1: Autenticação Legada (Canal Direto) ---
    if (channelHeader && authHeader) {
      const channel = await channelService.findByApiKeyAndSlug(authHeader, channelHeader);
      
      if (!channel) {
        logger.warn(`[Auth] Falha auth legada: ${channelHeader}`);
        return res.status(401).json({ error: 'Invalid Channel Credentials' });
      }

      if (!channel.isActive) {
        return res.status(403).json({ error: 'Channel is inactive' });
      }

      res.locals.targetChannel = channel;
      res.locals.authStrategy = 'direct';
      return next();
    }

    // --- ESTRATÉGIA 2: Roteamento Dinâmico (Tenant) ---
    if (tenantKeyHeader) {
      const tenant = await prisma.tenant.findUnique({
        where: { apiToken: tenantKeyHeader }
      });

      if (!tenant) {
        return res.status(401).json({ error: 'Invalid Tenant API Token' });
      }

      if (!tenant.isActive) {
        return res.status(403).json({ error: 'Tenant is inactive' });
      }

      // Parse antecipado para roteamento
      let callEntity;
      try {
        callEntity = PayloadFactory.create(req.body);
      } catch (e: any) {
        logger.warn(`[Auth] Payload inválido para roteamento: ${e.message}`);
        // Retorna 400 explicitamente para erros de payload na fase de auth
        return res.status(400).json({ error: e.message });
      }

      const targetChannel = await channelRouter.route(
        tenant.id, 
        callEntity.rawSource, 
        callEntity.routingKey
      );

      if (!targetChannel) {
        logger.warn(`[Auth] Roteamento falhou para Tenant ${tenant.name}`, {
          source: callEntity.rawSource,
          key: callEntity.routingKey
        });
        return res.status(404).json({ 
          error: 'No matching channel found for this payload',
          debug: { source: callEntity.rawSource, key: callEntity.routingKey }
        });
      }

      if (!targetChannel.isActive) {
        return res.status(403).json({ error: 'Target Channel is inactive' });
      }

      res.locals.targetChannel = targetChannel;
      res.locals.preParsedEntity = callEntity;
      res.locals.authStrategy = 'routing';
      return next();
    }

    // --- FALHA: Nenhum header válido ---
    // Retorna 401 conforme esperado pelos testes e padrão HTTP
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing valid authentication headers'
    });

  } catch (error) {
    logger.error('[AuthMiddleware] Erro interno', error);
    return res.status(500).json({ error: 'Internal Auth Error' });
  }
};

/**
 * Controller Factory
 */
export const createIngestController = (socketService: SocketService) => {
  return async (req: Request, res: Response) => {
    try {
      const channel = res.locals.targetChannel;
      const strategy = res.locals.authStrategy;
      
      // Usa entidade pré-parseada ou parseia agora (para estratégia direta)
      const callEntity = res.locals.preParsedEntity || PayloadFactory.create(req.body);

      // Persistência futura aqui...

      // Broadcast
      socketService.broadcastCall(channel.slug, callEntity);

      logger.info(`[Ingest] Sucesso via ${strategy}`, {
        channel: channel.slug,
        routingKey: callEntity.routingKey
      });

      return res.status(200).json({
        success: true,
        channel: channel.slug,
        routing_key: callEntity.routingKey
      });

    } catch (error: any) {
      // Tratamento específico de erros para manter contrato com testes/clientes
      
      // Erro de Validação Zod (geralmente lançado pela Factory)
      if (error.name === 'ZodError' || (error.errors && Array.isArray(error.errors))) {
        logger.warn('[Ingest] Payload inválido (Zod)', { error: error.message });
        return res.status(422).json({
          success: false,
          error: 'Payload inválido',
          details: error.errors
        });
      }

      // Erro de Regra de Negócio / Formato Desconhecido
      if (error.message === 'Formato de payload desconhecido ou não suportado.') {
         return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      // Erro genérico
      logger.error('[IngestController] Erro de processamento', error);
      return res.status(500).json({ error: 'Internal Processing Error' });
    }
  };
};