import { TenantService } from '../tenant.service';
import { randomUUID } from 'crypto';

// Mock do Prisma
jest.mock('@prisma/client', () => {
  const mockCreate = jest.fn();
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();

  return {
    PrismaClient: jest.fn(() => ({
      tenant: {
        create: mockCreate,
        findUnique: mockFindUnique,
        update: mockUpdate,
      },
    })),
    __mocks: {
      create: mockCreate,
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

describe('Tenant Service', () => {
  let service: TenantService;

  beforeEach(() => {
    service = new TenantService();
    (randomUUID as jest.Mock).mockReturnValue('mocked-uuid-token');
    jest.clearAllMocks();
  });

  // --- Casos de Sucesso (Happy Path) ---

  it('createTenant deve criar tenant com apiToken gerado', async () => {
    const input = { name: 'Hospital Y', slug: 'hospital-y' };
    const created = { ...input, id: 't1', apiToken: 'mocked-uuid-token', isActive: true };
    prismaMocks.create.mockResolvedValue(created);

    const result = await service.createTenant(input);

    expect(result).toEqual(created);
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: {
        ...input,
        apiToken: 'mocked-uuid-token',
        isActive: true,
      },
    });
  });

  it('findByApiToken deve retornar tenant se ativo e token bater', async () => {
    const tenant = { id: 't1', name: 'Hosp Y', isActive: true };
    prismaMocks.findUnique.mockResolvedValue(tenant);

    const result = await service.findByApiToken('valid-token');

    expect(result).toEqual(tenant);
    expect(prismaMocks.findUnique).toHaveBeenCalledWith({
      where: { apiToken: 'valid-token', isActive: true },
    });
  });

  it('rotateTenantKey deve atualizar apiToken', async () => {
    const updated = { id: 't1', apiToken: 'mocked-uuid-token' };
    prismaMocks.update.mockResolvedValue(updated);

    const result = await service.rotateTenantKey('t1');

    expect(result).toEqual(updated);
    expect(prismaMocks.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { apiToken: 'mocked-uuid-token' },
    });
  });

  // --- Edge Cases e Tratamento de Erros ---

  describe('Edge Cases', () => {
    it('createTenant deve propagar erro de violação de constraint (slug duplicado)', async () => {
      const input = { name: 'Hospital Y', slug: 'hospital-y' };
      const prismaError = new Error('Unique constraint failed on the fields: (`slug`)');
      (prismaError as any).code = 'P2002';
      
      prismaMocks.create.mockRejectedValue(prismaError);

      await expect(service.createTenant(input)).rejects.toThrow('Unique constraint failed');
    });

    it('findByApiToken deve retornar null se tenant não encontrado', async () => {
      prismaMocks.findUnique.mockResolvedValue(null);

      const result = await service.findByApiToken('invalid-token');

      expect(result).toBeNull();
    });

    // Este teste valida indiretamente que o filtro isActive: true está sendo usado na query
    // O mock do Prisma retorna o que mandamos, então verificamos os argumentos da chamada
    it('findByApiToken deve filtrar por isActive: true', async () => {
      prismaMocks.findUnique.mockResolvedValue(null); // Simula não encontrar

      await service.findByApiToken('token-de-inativo');

      expect(prismaMocks.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ 
            apiToken: 'token-de-inativo',
            isActive: true 
          })
        })
      );
    });

    it('rotateTenantKey deve lançar erro se tenant não existir', async () => {
      const prismaError = new Error('Record to update not found.');
      (prismaError as any).code = 'P2025';
      
      prismaMocks.update.mockRejectedValue(prismaError);

      await expect(service.rotateTenantKey('non-existent-id')).rejects.toThrow('Record to update not found');
    });
  });
});