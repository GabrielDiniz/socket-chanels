// src/server/services/channel.router.ts
import { prisma } from '../config/prisma';
import { Channel,Prisma } from '@prisma/client';

export class ChannelRouterService {
  /**
   * Encontra o canal correto baseado no Tenant + Sistema de Origem + Chave de Roteamento
   */
  async route(tenantId: string, sourceSystem: string, routingKey?: string): Promise<Channel | null> {
    if (!routingKey) {
      return null;
    }

    // 1. Busca canais do Tenant com configuração de roteamento
    const channels = await prisma.channel.findMany({
      where: {
        tenantId: tenantId,
        routingKeyMap: {
          not: Prisma.DbNull 
        }
      }
    });

    // 2. Filtra em memória pelo JSON
    const matchedChannel = channels.find(channel => {
      const map = channel.routingKeyMap as Record<string, string | number | Array<string | number>> | null;
      
      if (!map) return false;

      const ruleValue = map[sourceSystem];

      if (!ruleValue) return false;

      if (Array.isArray(ruleValue)) {
        return ruleValue.some(v => String(v) === String(routingKey));
      }

      return String(ruleValue) === String(routingKey);
    });

    return matchedChannel || null;
  }
}

export const channelRouter = new ChannelRouterService();