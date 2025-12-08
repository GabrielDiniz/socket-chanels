import { ChannelService } from '../channel.service';
import { randomUUID } from 'crypto';

// Mock do Prisma
jest.mock('@prisma/client', () => {
  const mockFindFirst = jest.fn();
  const mockCreate = jest.fn();
  const mockFindMany = jest.fn();
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();

  return {
    PrismaClient: jest.fn(() => ({
      channel: {
        findFirst: mockFindFirst,
        create: mockCreate,
        findMany: mockFindMany,
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
    })),
    __mocks: {
      findFirst: mockFindFirst,
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  };
});

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

const { __mocks: prismaMocks } = require('@prisma/client') as any;

describe('Channel Service', () => {
  let service: ChannelService;

  beforeEach(() => {
    service = new ChannelService();
    (randomUUID as jest.Mock).mockReturnValue('mocked-uuid-123');
    jest.clearAllMocks();
  });

  // --- Buscas Públicas / Dispositivo ---

  it('findByApiKeyAndSlug deve retornar channel com tenant', async () => {
    const mockChannelData = { id: '1', apiKey: 'key', slug: 'sala', isActive: true, tenant: { id: 't1' } };
    prismaMocks.findFirst.mockResolvedValue(mockChannelData);

    const result = await service.findByApiKeyAndSlug('key', 'sala');

    expect(result).toEqual(mockChannelData);
    expect(prismaMocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ include: { tenant: true } })
    );
  });

  // --- Gestão por Tenant ---

  it('createChannel deve exigir tenantId e criar canal vinculado', async () => {
    const input = { slug: 'novo', name: 'Canal', tenantId: 'tenant-1' };
    const created = { id: '10', ...input, apiKey: 'mocked-uuid-123' };
    prismaMocks.create.mockResolvedValue(created);

    const result = await service.createChannel(input);

    expect(result).toEqual(created);
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1' })
    });
  });

  it('listByTenant deve filtrar por tenantId e isActive', async () => {
    const channels = [{ id: '1', name: 'C1' }];
    prismaMocks.findMany.mockResolvedValue(channels);

    const result = await service.listByTenant('tenant-1');

    expect(result).toEqual(channels);
    expect(prismaMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', isActive: true }
      })
    );
  });

  it('updateChannel deve falhar se canal não pertencer ao tenant', async () => {
    prismaMocks.findFirst.mockResolvedValue(null); // Canal não encontrado para esse tenant

    await expect(service.updateChannel('slug-alheio', { name: 'X' }, 'meu-tenant'))
      .rejects.toThrow('Channel not found or access denied');
  });

  it('updateChannel deve atualizar se canal pertencer ao tenant', async () => {
    const channel = { id: 'c1', slug: 'meu-slug', tenantId: 'meu-tenant' };
    prismaMocks.findFirst.mockResolvedValue(channel);
    prismaMocks.update.mockResolvedValue({ ...channel, name: 'Novo Nome' });

    const result = await service.updateChannel('meu-slug', { name: 'Novo Nome' }, 'meu-tenant');

    expect(result.name).toBe('Novo Nome');
    expect(prismaMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ name: 'Novo Nome' })
      })
    );
  });

  it('deleteChannel deve realizar soft delete apenas se for dono', async () => {
    const channel = { id: 'c1', slug: 'meu-slug', tenantId: 'meu-tenant' };
    prismaMocks.findFirst.mockResolvedValue(channel);
    prismaMocks.update.mockResolvedValue({ ...channel, isActive: false });

    await service.deleteChannel('meu-slug', 'meu-tenant');

    expect(prismaMocks.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isActive: false }
    });
  });

  it('deleteChannel deve falhar se canal não existir ou não pertencer ao tenant', async () => {
    // Caso 1: Canal inexistente
    prismaMocks.findFirst.mockResolvedValue(null);

    await expect(service.deleteChannel('nao-existe', 'meu-tenant'))
      .rejects.toThrow('Channel not found or access denied');

    // Caso 2: Canal pertence a outro tenant
    const otherChannel = { id: 'c2', slug: 'slug-alheio', tenantId: 'outro-tenant' };
    // O mock findFirst retorna null porque a query 'where' (slug + tenantId) não encontrará correspondência
    prismaMocks.findFirst.mockResolvedValue(null);

    await expect(service.deleteChannel('slug-alheio', 'meu-tenant'))
      .rejects.toThrow('Channel not found or access denied');
  });
   // --- Admin Global ---

  it('listActive deve retornar todos os canais ativos ordenados e com tenant', async () => {
    const activeChannels = [
      { id: '1', name: 'C1', createdAt: new Date('2025-01-02'), tenant: { id: 't1' } },
      { id: '2', name: 'C2', createdAt: new Date('2025-01-01'), tenant: { id: 't2' } }
    ];
    prismaMocks.findMany.mockResolvedValue(activeChannels);

    const result = await service.listActive();

    expect(result).toEqual(activeChannels);
    expect(prismaMocks.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { tenant: true }
    });
  });
});