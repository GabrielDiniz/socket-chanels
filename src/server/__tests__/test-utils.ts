import { prisma } from '../config/prisma';
import { randomUUID } from 'crypto';
import Client, { Socket as ClientSocket } from 'socket.io-client';

// Limpa todas as tabelas para garantir testes isolados
export const resetDatabase = async () => {
  // A ordem importa devido às chaves estrangeiras
  await prisma.call.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.tenant.deleteMany();
};

// Cria um canal mock para testes, garantindo que um Tenant exista
export const createMockChannel = async (overrides: any = {}) => {
  // 1. Cria um Tenant para ser o dono do canal
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Tenant de Teste',
      slug: `tenant-teste-${randomUUID()}`,
      apiToken: randomUUID(),
      isActive: true,
    }
  });

  const defaultSlug = `test_channel_${randomUUID()}`;
  
  // 2. Cria o Canal vinculado ao Tenant
  return prisma.channel.create({
    data: {
      slug: defaultSlug,
      name: 'Canal de Teste Automatizado',
      // system removido
      apiKey: randomUUID(),
      tenantId: tenant.id, // Vincula ao tenant criado
      ...overrides,
    },
  });
};

// Helper para aguardar (sleep) - útil para testes assíncronos de socket
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper para criar cliente de socket de teste
export const createSocketClient = (port: number): ClientSocket => {
  return Client(`http://localhost:${port}`, {
    autoConnect: true,
    transports: ['websocket'], // Força websocket para evitar polling em testes
    forceNew: true,
  });
};