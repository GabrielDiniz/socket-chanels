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