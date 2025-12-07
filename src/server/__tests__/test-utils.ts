import { prisma } from '../config/prisma';
import { randomUUID } from 'crypto';
import Client, { Socket as ClientSocket } from 'socket.io-client';

// Limpa todas as tabelas para garantir testes isolados
export const resetDatabase = async () => {
  try {
    // A ordem importa devido às chaves estrangeiras (Call depende de Channel)
    await prisma.call.deleteMany();
    await prisma.channel.deleteMany();
  } catch (error) {
    console.error('Falha ao limpar banco de dados de teste:', error);
    throw new Error('Não foi possível limpar o banco de testes. Verifique a conexão.');
  }
};

// Cria um canal mock para testes
export const createMockChannel = async (overrides = {}) => {
  const defaultSlug = `test_channel_${randomUUID()}`;
  return prisma.channel.create({
    data: {
      slug: defaultSlug,
      name: 'Canal de Teste Automatizado',
      system: 'TestSystem',
      tenant: 'TestTenant',
      apiKey: randomUUID(),
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