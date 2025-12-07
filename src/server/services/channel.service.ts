// src/server/services/channel.service.ts
import { prisma } from '../config/prisma';
import { randomUUID } from 'crypto';

export class ChannelService {
  async findByApiKeyAndSlug(apiKey: string, slug: string) {
    return prisma.channel.findFirst({
      where: {
        apiKey,
        slug,
        isActive: true,
      },
    });
  }

  async findBySlug(slug: string) {
    return prisma.channel.findUnique({
      where: { slug },
    });
  }

  async getHistory(channelSlug: string, limit = 10) {
    // Primeiro buscamos o ID do canal pelo slug
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
        // Não expomos rawPayload por padrão para economizar banda
      }
    });

    // Mapeia para o formato de entidade simplificado usado no frontend/socket
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

  async createChannel(data: {
    slug: string;
    name: string;
    tenant?: string;
  }) {
    const apiKey = randomUUID();

    return prisma.channel.create({
      data: {
        ...data,
        apiKey,
      },
    });
  }

  // Usado no admin futuro
  async listActive() {
    return prisma.channel.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const channelService = new ChannelService();