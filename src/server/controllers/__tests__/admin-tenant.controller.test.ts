import { Request, Response } from 'express';
import { adminTenantController } from '../admin-tenant.controller';
import { tenantService } from '../../services/tenant.service';

// Mock do tenantService
jest.mock('../../services/tenant.service', () => ({
  tenantService: {
    createTenant: jest.fn(),
    rotateTenantKey: jest.fn(),
  },
}));

// Mock do prisma (necessário para o método list que usa prisma direto temporariamente)
jest.mock('../../config/prisma', () => ({
  prisma: {
    tenant: {
      findMany: jest.fn(),
    },
  },
}));

// Helper para mockar Response
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  return res;
};

describe('Admin Tenant Controller', () => {
  let req: Partial<Request>;
  let res: Response;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
  });

  describe('create', () => {
    it('Deve criar um tenant com sucesso (201)', async () => {
      req = {
        body: {
          name: 'Hospital Z',
          slug: 'hospital-z',
          webhookUrl: 'http://webhook.com',
        },
      };

      const mockCreatedTenant = {
        id: 't1',
        ...req.body,
        apiToken: 'new-token',
        isActive: true,
      };

      (tenantService.createTenant as jest.Mock).mockResolvedValue(mockCreatedTenant);

      await adminTenantController.create(req as Request, res);

      expect(tenantService.createTenant).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        tenant: expect.objectContaining({
          id: 't1',
          slug: 'hospital-z',
          apiToken: 'new-token',
        }),
      });
    });

    it('Deve retornar 400 se o body for inválido (Zod)', async () => {
      req = {
        body: {
          name: 'H', // Muito curto
          slug: 'Invalid Slug!', // Caracteres inválidos
        },
      };

      await adminTenantController.create(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad Request' }));
      expect(tenantService.createTenant).not.toHaveBeenCalled();
    });

    it('Deve retornar 409 se o slug já existir (P2002)', async () => {
      req = {
        body: { name: 'Hospital Duplicado', slug: 'duplicado' },
      };

      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';

      (tenantService.createTenant as jest.Mock).mockRejectedValue(prismaError);

      await adminTenantController.create(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Conflict' }));
    });

    it('Deve retornar 500 em erro genérico', async () => {
      req = {
        body: { name: 'Hospital X', slug: 'hospital-x' },
      };

      (tenantService.createTenant as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await adminTenantController.create(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('list', () => {
    it('Deve listar tenants com sucesso (200)', async () => {
      const { prisma } = require('../../config/prisma');
      const mockTenants = [{ id: '1', name: 'T1' }, { id: '2', name: 'T2' }];
      
      prisma.tenant.findMany.mockResolvedValue(mockTenants);

      await adminTenantController.list({} as Request, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, tenants: mockTenants });
    });

    it('Deve retornar 500 se o banco falhar', async () => {
      const { prisma } = require('../../config/prisma');
      prisma.tenant.findMany.mockRejectedValue(new Error('DB Fail'));

      await adminTenantController.list({} as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('rotateKey', () => {
    it('Deve rotacionar a chave com sucesso (200)', async () => {
      req = { params: { id: 'tenant-1' } };
      const mockUpdated = { id: 'tenant-1', apiToken: 'rotated-token' };

      (tenantService.rotateTenantKey as jest.Mock).mockResolvedValue(mockUpdated);

      await adminTenantController.rotateKey(req as Request, res);

      expect(tenantService.rotateTenantKey).toHaveBeenCalledWith('tenant-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        apiToken: 'rotated-token',
      }));
    });

    it('Deve retornar 404 se o tenant não existir (P2025)', async () => {
      req = { params: { id: 'missing-id' } };
      
      const prismaError = new Error('Record not found');
      (prismaError as any).code = 'P2025';

      (tenantService.rotateTenantKey as jest.Mock).mockRejectedValue(prismaError);

      await adminTenantController.rotateKey(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Not Found' }));
    });

    it('Deve retornar 500 em erro genérico', async () => {
      req = { params: { id: 'tenant-1' } };
      (tenantService.rotateTenantKey as jest.Mock).mockRejectedValue(new Error('DB Fail'));

      await adminTenantController.rotateKey(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});