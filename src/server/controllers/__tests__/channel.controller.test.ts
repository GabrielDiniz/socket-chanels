import { Request, Response } from 'express';
// Importação dinâmica do controller para evitar cache de mocks
// import { channelController } from '../channel.controller';

// Mocks globais (hoisted)
jest.mock('../../services/channel.service', () => ({
  channelService: {
    listByTenant: jest.fn(),
    createChannel: jest.fn(),
    updateChannel: jest.fn(),
    deleteChannel: jest.fn(),
  },
}));

// Mock do logger para evitar poluição no console
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Channel Controller', () => {
  let req: Partial<Request>;
  let res: Response;
  let next: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let channelController: any;
  let serviceMock: any;

  beforeEach(async () => {
    jest.resetModules();
    
    // Re-importa dependências
    const serviceModule = require('../../services/channel.service');
    serviceMock = serviceModule.channelService;

    const controllerModule = await require('../channel.controller');
    channelController = controllerModule.channelController;

    jest.clearAllMocks();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    // Simula um request autenticado por um Tenant
    req = { 
      body: {},
      tenant: { id: 'tenant-123', name: 'Tenant Teste', slug: 'tenant-teste' }
    };
  });

  describe('list', () => {
    it('Deve listar canais do tenant autenticado (200)', async () => {
      const mockChannels = [
        { slug: 'c1', name: 'Canal 1', apiKey: 'k1', isActive: true, createdAt: new Date() }
      ];
      serviceMock.listByTenant.mockResolvedValue(mockChannels);

      await channelController.list(req as Request, res);

      expect(serviceMock.listByTenant).toHaveBeenCalledWith('tenant-123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        channels: expect.arrayContaining([
          expect.objectContaining({ slug: 'c1' })
        ])
      });
    });

    it('Deve retornar 500 em erro interno', async () => {
      serviceMock.listByTenant.mockRejectedValue(new Error('DB Fail'));
      await channelController.list(req as Request, res);
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe('create', () => {
    it('Deve criar canal vinculado ao tenant (201)', async () => {
      req.body = { slug: 'novo-canal', name: 'Novo Canal' };
      const mockCreated = { ...req.body, apiKey: 'new-key', isActive: true };
      
      serviceMock.createChannel.mockResolvedValue(mockCreated);

      await channelController.create(req as Request, res);

      expect(serviceMock.createChannel).toHaveBeenCalledWith({
        ...req.body,
        tenantId: 'tenant-123'
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        channel: expect.objectContaining({ slug: 'novo-canal' })
      });
    });

    it('Deve retornar 400 se body inválido (Zod)', async () => {
      req.body = { slug: 'Inválido!', name: '' }; // Slug com chars especiais, nome vazio
      await channelController.create(req as Request, res);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(serviceMock.createChannel).not.toHaveBeenCalled();
    });

    it('Deve retornar 409 se slug duplicado (P2002)', async () => {
      req.body = { slug: 'duplicado', name: 'Teste' };
      const err = new Error('Unique constraint');
      (err as any).code = 'P2002';
      
      serviceMock.createChannel.mockRejectedValue(err);

      await channelController.create(req as Request, res);
      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it('Deve retornar 500 em caso de erro genérico', async () => {
      req.body = { slug: 'erro-500', name: 'Erro' };
      serviceMock.createChannel.mockRejectedValue(new Error('Unexpected Error'));

      await channelController.create(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Internal Server Error'
      }));
    });
  });

  describe('update', () => {
    it('Deve atualizar canal do tenant (200)', async () => {
      req.params = { slug: 'meu-canal' };
      req.body = { name: 'Editado' };
      
      serviceMock.updateChannel.mockResolvedValue({ slug: 'meu-canal', name: 'Editado' });

      await channelController.update(req as Request, res);

      expect(serviceMock.updateChannel).toHaveBeenCalledWith('meu-canal', req.body, 'tenant-123');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        channel: expect.objectContaining({ name: 'Editado' })
      }));
    });

    it('Deve retornar 404 se canal não existir ou pertencer a outro tenant', async () => {
      req.params = { slug: 'alheio' };
      req.body = { name: 'X' };
      
      serviceMock.updateChannel.mockRejectedValue(new Error('Channel not found or access denied'));

      await channelController.update(req as Request, res);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('Deve retornar 400 em caso de falha na validação (ZodError)', async () => {
      req.params = { slug: 'meu-canal' };
      // Nome vazio viola o schema .min(1)
      req.body = { name: '' }; 

      await channelController.update(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Bad Request'
      }));
      expect(serviceMock.updateChannel).not.toHaveBeenCalled();
    });

    it('Deve retornar 500 em caso de erro genérico', async () => {
      req.params = { slug: 'meu-canal' };
      req.body = { name: 'Update Falho' };
      
      serviceMock.updateChannel.mockRejectedValue(new Error('DB connection failed'));

      await channelController.update(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Internal Server Error'
      }));
    });
  });

  describe('delete', () => {
    it('Deve deletar canal do tenant (200)', async () => {
      req.params = { slug: 'lixo' };
      
      await channelController.delete(req as Request, res);

      expect(serviceMock.deleteChannel).toHaveBeenCalledWith('lixo', 'tenant-123');
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('Deve retornar 404 se canal não for do tenant', async () => {
      req.params = { slug: 'alheio' };
      serviceMock.deleteChannel.mockRejectedValue(new Error('Channel not found or access denied'));

      await channelController.delete(req as Request, res);
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('Deve retornar 500 em caso de erro genérico', async () => {
      req.params = { slug: 'lixo' };
      serviceMock.deleteChannel.mockRejectedValue(new Error('Critical DB Fail'));

      await channelController.delete(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Internal Server Error'
      }));
    });
  });
});