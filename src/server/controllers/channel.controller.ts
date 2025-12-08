import { Request, Response } from 'express';
import { channelService } from '../services/channel.service';
import { z } from 'zod';
import { logger } from '../config/logger';

// Schemas de validação
const createChannelSchema = z.object({
  slug: z.string()
    .regex(/^[a-z0-9_-]+$/, 'Apenas letras minúsculas, números, _ e -')
    .min(3)
    .max(50),
  name: z.string().min(1).max(100),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100),
});

export class ChannelController {
  
  /**
   * Lista todos os canais do tenant autenticado
   */
  async list(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id; 
      const channels = await channelService.listByTenant(tenantId);

      return res.json({
        success: true,
        channels: channels.map(c => ({
          slug: c.slug,
          name: c.name,
          apiKey: c.apiKey,
          isActive: c.isActive,
          createdAt: c.createdAt
        }))
      });
    } catch (error: any) {
      logger.error('[Channel] Erro ao listar canais', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Cria um novo canal para o tenant
   */
  async create(req: Request, res: Response) {
    try {
      const body = createChannelSchema.parse(req.body);
      const tenantId = req.tenant!.id;

      const channel = await channelService.createChannel({
        ...body,
        tenantId
      });

      logger.info('[Channel] Canal criado', { 
        slug: channel.slug, 
        tenant: req.tenant!.slug 
      });

      return res.status(201).json({
        success: true,
        channel: {
          slug: channel.slug,
          name: channel.name,
          apiKey: channel.apiKey,
        }
      });

    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Bad Request', details: error.errors });
      }
      
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Conflict', message: 'Slug já está em uso.' });
      }

      logger.error('[Channel] Erro ao criar canal', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Edita um canal
   */
  async update(req: Request, res: Response) {
    const { slug } = req.params;
    const tenantId = req.tenant!.id;

    try {
      const body = updateChannelSchema.parse(req.body);
      const updated = await channelService.updateChannel(slug, body, tenantId);

      return res.json({
        success: true,
        channel: {
          slug: updated.slug,
          name: updated.name,
        }
      });
    } catch (error: any) {
      if (error.message === 'Channel not found or access denied') {
        return res.status(404).json({ error: 'Not Found', message: 'Canal não encontrado' });
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Bad Request', details: error.errors });
      }
      
      logger.error('[Channel] Erro ao editar canal', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Remove (soft delete) um canal
   */
  async delete(req: Request, res: Response) {
    const { slug } = req.params;
    const tenantId = req.tenant!.id;

    try {
      await channelService.deleteChannel(slug, tenantId);
      
      logger.info('[Channel] Canal deletado', { slug, tenant: req.tenant!.slug });

      return res.status(200).json({
        success: true,
        message: 'Canal desativado com sucesso'
      });
    } catch (error: any) {
      if (error.message === 'Channel not found or access denied') {
        return res.status(404).json({ error: 'Not Found', message: 'Canal não encontrado' });
      }
      logger.error('[Channel] Erro ao deletar canal', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const channelController = new ChannelController(); // Exporta como instância ou função (adaptar se necessário)
// Para manter compatibilidade com a chamada antiga (que era uma função única), 
// exportamos o método create como default ou adaptamos as rotas. 
// Mas como estamos mudando as rotas, vamos exportar a instância da classe.