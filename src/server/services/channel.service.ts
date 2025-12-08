import { prisma } from '../config/prisma';
import { randomUUID } from 'crypto';

export class ChannelService {
  /**
   * Busca canal por API Key e Slug (Autenticação da TV/Totem)
   * Continua agnóstico de tenant pois é usado pelo dispositivo final.
   */
  async findByApiKeyAndSlug(apiKey: string, slug: string) {
    return prisma.channel.findFirst({
      where: {
        apiKey,
        slug,
        isActive: true,
      },
      include: {
        tenant: true 
      }
    });
  }

  /**
   * Busca por Slug (Uso interno/admin)
   */
  async findBySlug(slug: string) {
    return prisma.channel.findUnique({
      where: { slug },
      include: { tenant: true }
    });
  }

  /**
   * Histórico de chamadas (Público/Frontend)
   */
  async getHistory(channelSlug: string, limit = 10) {
    const channel = await this.findBySlug(channelSlug);
    
    if (!channel) return null;

    const calls = await prisma.call.findMany({
      where: { channelId: channel.id },
      orderBy: { calledAt: 'desc' },
      take: limit,
      select: {
        id: true,
        patientName: true,
        destination: true,
        professional: true,
        isPriority: true,
        calledAt: true,
        sourceSystem: true,
      }
    });

    return calls.map(c => ({
      id: c.id,
      name: c.patientName,
      destination: c.destination,
      professional: c.professional,
      timestamp: c.calledAt,
      isPriority: c.isPriority,
      rawSource: c.sourceSystem,
    }));
  }

  /**
   * Criação de Canal (Agora exige vínculo com Tenant)
   */
  async createChannel(data: {
    slug: string;
    name: string;
    tenantId: string; // Obrigatório na camada de serviço
  }) {
    const apiKey = randomUUID();

    return prisma.channel.create({
      data: {
        slug: data.slug,
        name: data.name,
        apiKey,
        tenantId: data.tenantId,
        isActive: true,
      },
    });
  }

  /**
   * Lista todos os canais de um Tenant específico
   */
  async listByTenant(tenantId: string) {
    return prisma.channel.findMany({
      where: { 
        tenantId,
        isActive: true 
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Atualiza canal garantindo isolamento
   */
  async updateChannel(slug: string, data: { name?: string }, tenantId: string) {
    // Primeiro verifica se o canal pertence ao tenant
    const channel = await prisma.channel.findFirst({
      where: { slug, tenantId }
    });

    if (!channel) {
      throw new Error('Channel not found or access denied');
    }

    return prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...data,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Deleta (soft delete) canal garantindo isolamento
   */
  async deleteChannel(slug: string, tenantId: string) {
    const channel = await prisma.channel.findFirst({
      where: { slug, tenantId }
    });

    if (!channel) {
      throw new Error('Channel not found or access denied');
    }

    return prisma.channel.update({
      where: { id: channel.id },
      data: { isActive: false }
    });
  }

  // Admin global (Backoffice)
  async listActive() {
    return prisma.channel.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { tenant: true }
    });
  }
}

export const channelService = new ChannelService();