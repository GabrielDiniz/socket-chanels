import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../services/tenant.service';
import { logger } from '../config/logger';

// Extensão da interface Request para incluir o tenant
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        name: string;
        slug: string;
      };
    }
  }
}

export const tenantAuthMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const tenantToken = req.headers['x-tenant-token'] as string;

  if (!tenantToken) {
    logger.warn('[TenantAuth] Tentativa de acesso sem token de tenant', { ip: req.ip });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Header x-tenant-token é obrigatório',
    });
    return;
  }

  try {
    const tenant = await tenantService.findByApiToken(tenantToken);

    if (!tenant) {
      logger.warn('[TenantAuth] Token de tenant inválido ou inativo', { ip: req.ip });
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token inválido ou tenant inativo',
      });
      return;
    }

    // Anexa o tenant ao request para uso nos controllers
    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    };

    next();
  } catch (error: any) {
    logger.error('[TenantAuth] Erro ao validar token', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};