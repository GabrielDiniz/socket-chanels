import { Request, Response } from 'express';
import { tenantService } from '../services/tenant.service';
import { z } from 'zod';
import { logger } from '../config/logger';

// Schemas de validação locais para o controller
const createTenantSchema = z.object({
  name: z.string().min(3),
  slug: z.string().regex(/^[a-z0-9_-]+$/, 'Apenas letras minúsculas, números, _ e -'),
  webhookUrl: z.string().url().optional(),
});

export class AdminTenantController {
  
  /**
   * POST /admin/tenants
   * Cria um novo Tenant
   */
  async create(req: Request, res: Response) {
    try {
      const body = createTenantSchema.parse(req.body);

      // Verifica duplicidade de slug (embora o service/banco trate, é bom verificar antes para msg amigável)
      // O Prisma lança erro P2002, mas podemos checar aqui ou tratar o erro do prisma.
      // Vamos deixar o service lidar e tratar o erro.

      const tenant = await tenantService.createTenant(body);

      logger.info('[Admin] Tenant criado', { id: tenant.id, slug: tenant.slug });

      return res.status(201).json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          apiToken: tenant.apiToken, // Retorna o token apenas na criação
          webhookUrl: tenant.webhookUrl,
        }
      });

    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Bad Request', details: error.errors });
      }
      
      // Tratamento de erro de constraint unique do Prisma
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Conflict', message: 'Slug já está em uso.' });
      }

      logger.error('[Admin] Erro ao criar tenant', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * GET /admin/tenants
   * Lista todos os tenants (ativos ou não, idealmente paginado, mas simplificado aqui)
   */
  async list(req: Request, res: Response) {
    try {
      // Como o service não tem um método "listAll" ainda, podemos usar o prisma direto ou adicionar no service.
      // Vamos manter a boa prática e adicionar/usar o prisma direto aqui por simplicidade
      // ou idealmente estender o TenantService.
      // Para manter consistência com o padrão, vamos injetar o prisma aqui temporariamente
      // ou melhor: adicionar um método listAll no TenantService depois.
      // Por hora, vou importar o prisma direto para leitura.
      const { prisma } = require('../config/prisma');
      
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          createdAt: true,
          // Não retornamos apiToken na listagem por segurança
        }
      });

      return res.json({ success: true, tenants });
    } catch (error: any) {
      logger.error('[Admin] Erro ao listar tenants', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * POST /admin/tenants/:id/rotate-key
   * Rotaciona a chave de API de um tenant
   */
  async rotateKey(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const updatedTenant = await tenantService.rotateTenantKey(id);
      
      logger.info('[Admin] Chave rotacionada', { id });

      return res.json({
        success: true,
        message: 'Chave rotacionada com sucesso',
        apiToken: updatedTenant.apiToken
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Not Found', message: 'Tenant não encontrado' });
      }
      logger.error('[Admin] Erro ao rotacionar chave', { error: error.message });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const adminTenantController = new AdminTenantController();