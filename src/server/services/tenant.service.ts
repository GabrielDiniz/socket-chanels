import { prisma } from '../config/prisma';
import { randomUUID } from 'crypto';

export class TenantService {
  /**
   * Cria um novo Tenant e gera automaticamente seu apiToken
   */
  async createTenant(data: { name: string; slug: string; webhookUrl?: string }) {
    // Gera token único para o tenant
    const apiToken = randomUUID();

    return prisma.tenant.create({
      data: {
        ...data,
        apiToken,
        isActive: true,
      },
    });
  }

  /**
   * Busca um Tenant ativo pelo seu Api Token (usado em middlewares)
   */
  async findByApiToken(apiToken: string) {
    return prisma.tenant.findUnique({
      where: {
        apiToken,
        isActive: true,
      },
    });
  }

  /**
   * Rotaciona a chave de API de um Tenant (Segurança)
   * Invalida a anterior ao gerar uma nova.
   */
  async rotateTenantKey(tenantId: string) {
    const newApiKey = randomUUID();

    return prisma.tenant.update({
      where: { id: tenantId },
      data: { apiToken: newApiKey },
    });
  }
}

export const tenantService = new TenantService();