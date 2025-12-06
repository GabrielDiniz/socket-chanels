// src/server/services/__tests__/channel.service.test.ts

import { ChannelService } from '../channel.service';
import { randomUUID } from 'crypto';

// Mock do Prisma (usando funções diretamente, sem variáveis externas)
jest.mock('@prisma/client', () => {
  const mockFindFirst = jest.fn();
  const mockCreate = jest.fn();
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();

  return {
    PrismaClient: jest.fn(() => ({
      channel: {
        findFirst: mockFindFirst,
        create: mockCreate,
        findMany: mockFindMany,
        findUnique: mockFindUnique,
      },
    })),
    // Exporta os mocks para uso nos testes
    __mocks: {
      findFirst: mockFindFirst,
      create: mockCreate,
      findMany: mockFindMany,
    },
  };
});

// Mock do randomUUID
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

// Acessa os mocks do Prisma via __mocks
const { __mocks: prismaMocks } = require('@prisma/client') as any;

describe('Channel Service', () => {
  let service: ChannelService;

  beforeEach(() => {
    service = new ChannelService();
    (randomUUID as jest.Mock).mockReturnValue('mocked-uuid-123');
    jest.clearAllMocks();
  });

  it('findByApiKeyAndSlug deve retornar channel ativo válido', async () => {
    const mockChannelData = { id: '1', apiKey: 'key123', slug: 'recepcao', isActive: true };
    prismaMocks.findFirst.mockResolvedValue(mockChannelData);

    const result = await service.findByApiKeyAndSlug('key123', 'recepcao');

    expect(result).toEqual(mockChannelData);
    expect(prismaMocks.findFirst).toHaveBeenCalledWith({
      where: { apiKey: 'key123', slug: 'recepcao', isActive: true },
    });
  });

  it('findByApiKeyAndSlug deve retornar null em channel inativo ou inexistente', async () => {
    prismaMocks.findFirst.mockResolvedValue(null);

    const result = await service.findByApiKeyAndSlug('wrong', 'wrong');

    expect(result).toBeNull();
  });

  it('createChannel deve criar channel com apiKey gerado', async () => {
    const input = { slug: 'novo-slug', name: 'Novo Canal' };
    const created = { id: '10', ...input, apiKey: 'mocked-uuid-123', isActive: true };
    prismaMocks.create.mockResolvedValue(created);

    const result = await service.createChannel(input);

    expect(result).toEqual(created);
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: { ...input, apiKey: 'mocked-uuid-123' },
    });
    expect(randomUUID).toHaveBeenCalled();
  });

  it('createChannel deve aceitar tenant opcional', async () => {
    const input = { slug: 'com-tenant', name: 'Com Tenant', tenant: 'Hospital X' };
    prismaMocks.create.mockResolvedValue({ id: '11', ...input, apiKey: 'mocked-uuid-123' });

    await service.createChannel(input);

    expect(prismaMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant: 'Hospital X' }),
      })
    );
  });

  it('listActive deve retornar canais ativos ordenados por createdAt desc', async () => {
    const channels = [
      { id: '1', name: 'A', createdAt: new Date('2025-01-02') },
      { id: '2', name: 'B', createdAt: new Date('2025-01-01') },
    ];
    prismaMocks.findMany.mockResolvedValue(channels);

    const result = await service.listActive();

    expect(result).toEqual(channels);
    expect(prismaMocks.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('Deve propagar erro do Prisma', async () => {
    prismaMocks.findFirst.mockRejectedValue(new Error('DB offline'));

    await expect(service.findByApiKeyAndSlug('x', 'y')).rejects.toThrow('DB offline');
  });
});