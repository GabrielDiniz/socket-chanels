import { Request, Response, NextFunction } from 'express';
import { createIngestController, authMiddleware } from '../ingest.controller';
import { prisma } from '../../config/prisma';
import { PayloadFactory } from '../../adapters/payload.factory';
import { channelService } from '../../services/channel.service';
import { channelRouter } from '../../services/channel.router';
import type { SocketService } from '../../services/socket.service';

// --- MOCKS ---
// CORREÇÃO: Adicionado parênteses que faltavam na chamada do mock
jest.mock('../../config/prisma', () => ({
  __esModule: true,
  prisma: {
    tenant: { findUnique: jest.fn() },
  },
}));

jest.mock('../../adapters/payload.factory');
jest.mock('../../services/channel.service');
jest.mock('../../services/channel.router');

const mockSocketService = {
  broadcastCall: jest.fn(),
} as unknown as SocketService;

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  // Simula o objeto locals do Express
  res.locals = {}; 
  return res;
};

describe('Ingest Controller', () => {
  let req: Partial<Request>;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, body: {} };
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  // =========================================================================
  // TESTES DO MIDDLEWARE (authMiddleware)
  // =========================================================================
  describe('authMiddleware', () => {
    
    // --- Estratégia 1: Auth Direta ---
    it('deve chamar next() se autenticação direta for válida', async () => {
      req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue({ id: '1', isActive: true });

      await authMiddleware(req as Request, res, next);

      expect(channelService.findByApiKeyAndSlug).toHaveBeenCalledWith('key', 'slug');
      expect(res.locals.targetChannel).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('deve retornar 403 se canal direto estiver inativo', async () => {
      req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue({ id: '1', isActive: false });

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Channel is inactive' }));
      expect(next).not.toHaveBeenCalled();
    });

    // --- Estratégia 2: Auth Tenant (Roteamento) ---
    it('deve chamar next() se autenticação tenant e roteamento forem válidos', async () => {
      req.headers = { 'x-tenant-key': 'tenant-token' };
      
      // Mocks para sucesso
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant1', isActive: true });
      (PayloadFactory.create as jest.Mock).mockReturnValue({ rawSource: 'SGA', routingKey: '5' });
      (channelRouter.route as jest.Mock).mockResolvedValue({ id: 'channel1', isActive: true, slug: 'recepcao' });

      await authMiddleware(req as Request, res, next);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { apiToken: 'tenant-token' } });
      expect(PayloadFactory.create).toHaveBeenCalled(); // Verifica payload
      expect(channelRouter.route).toHaveBeenCalledWith('tenant1', 'SGA', '5');
      expect(res.locals.targetChannel).toBeDefined();
      expect(res.locals.preParsedEntity).toBeDefined(); // Otimização deve estar presente
      expect(next).toHaveBeenCalled();
    });

    it('deve retornar 404 se roteamento não encontrar canal', async () => {
      req.headers = { 'x-tenant-key': 'tenant-token' };
      
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant1', isActive: true });
      (PayloadFactory.create as jest.Mock).mockReturnValue({ rawSource: 'Unknown', routingKey: 'X' });
      (channelRouter.route as jest.Mock).mockResolvedValue(null); // Canal não encontrado

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    // --- Falhas Gerais ---
    it('deve retornar 401 se faltar headers obrigatórios', async () => {
      req.headers = {}; // Sem headers

      await authMiddleware(req as Request, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }));
    });
  });

  // =========================================================================
  // TESTES DO CONTROLLER (createIngestController)
  // =========================================================================
  describe('createIngestController', () => {
    const controller = createIngestController(mockSocketService);

    it('deve retornar 200 em sucesso (usando dados injetados pelo middleware)', async () => {
      // Simula o middleware já ter populado o locals
      res.locals.targetChannel = { slug: 'recepcao', isActive: true };
      res.locals.authStrategy = 'direct';
      
      // Mock do Factory para o caso Direct (onde o middleware não parseou antes)
      (PayloadFactory.create as jest.Mock).mockReturnValue({ 
        routingKey: '5', 
        rawSource: 'SGA',
        name: 'A001' 
      });

      await controller(req as Request, res);

      expect(mockSocketService.broadcastCall).toHaveBeenCalledWith('recepcao', expect.anything());
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('deve reutilizar entidade pré-parseada se disponível (Otimização Tenant)', async () => {
      const preParsed = { routingKey: 'COL', rawSource: 'Versa' };
      res.locals.targetChannel = { slug: 'coleta', isActive: true };
      res.locals.preParsedEntity = preParsed;

      await controller(req as Request, res);

      // Não deve chamar o create novamente se já existe
      // Nota: PayloadFactory.create pode ter sido chamado antes, aqui focamos no resultado
      expect(mockSocketService.broadcastCall).toHaveBeenCalledWith('coleta', preParsed);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('deve retornar 422 se o Zod falhar na Factory (Erro de Payload)', async () => {
      res.locals.targetChannel = { slug: 'recepcao', isActive: true };
      
      // Simula erro de validação (ex: auth direta com payload ruim)
      const zodError = new Error('Validation Error');
      (zodError as any).name = 'ZodError';
      (zodError as any).errors = [{ message: 'Field required' }];
      
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        throw zodError;
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Payload inválido' }));
    });

    it('deve retornar 400 se o formato de payload for desconhecido', async () => {
      res.locals.targetChannel = { slug: 'recepcao', isActive: true };
      
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        throw new Error('Formato de payload desconhecido ou não suportado.');
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Formato de payload desconhecido ou não suportado.' }));
    });
  });
});