import { Request, Response, NextFunction } from 'express';
import { createIngestController, authMiddleware } from '../../controllers/ingest.controller';
import { prisma } from '../../config/prisma';
import { PayloadFactory } from '../../adapters/payload.factory';
import { channelService } from '../../services/channel.service';
import { channelRouter } from '../../services/channel.router';
import type { SocketService } from '../../services/socket.service';

// --- MOCKS ---
// Mock do Prisma para cobrir Tenant e Call
jest.mock('../../config/prisma', () => ({
  __esModule: true,
  prisma: {
    tenant: { findUnique: jest.fn() },
    call: { create: jest.fn() },
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
  // Simula locals
  res.locals = {};
  return res;
};

describe('Ingest Controller (Integration/KillSwitch)', () => {
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
    
    // Teste de Kill Switch na estratégia Legada
    it('deve chamar next() se autenticado e canal ativo (Legacy)', async () => {
      req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
      // Canal existe e está ativo
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue({ id: '1', isActive: true });

      await authMiddleware(req as Request, res, next);

      expect(channelService.findByApiKeyAndSlug).toHaveBeenCalledWith('key', 'slug');
      expect(next).toHaveBeenCalled();
    });

    it('deve retornar 403 se canal estiver inativo (Kill Switch - Legacy)', async () => {
      req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
      // Canal existe mas está inativo
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue({ id: '1', isActive: false });

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Channel is inactive' }));
      expect(next).not.toHaveBeenCalled();
    });

    // Teste de Kill Switch na estratégia de Roteamento (Tenant)
    it('deve retornar 403 se tenant estiver inativo (Kill Switch - Tenant)', async () => {
      req.headers = { 'x-tenant-key': 'tenant-token' };
      // Tenant existe mas está inativo
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 't1', isActive: false });

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Tenant is inactive' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 403 se canal de destino do roteamento estiver inativo', async () => {
      req.headers = { 'x-tenant-key': 'tenant-token' };
      
      // Tenant ok
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 't1', isActive: true });
      // Factory ok
      (PayloadFactory.create as jest.Mock).mockReturnValue({ rawSource: 'SGA', routingKey: '5' });
      // Router encontra canal, mas inativo
      (channelRouter.route as jest.Mock).mockResolvedValue({ id: 'c1', isActive: false });

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Target Channel is inactive' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 401 se faltar headers obrigatórios', async () => {
      req.headers = {}; 
      await authMiddleware(req as Request, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('deve retornar 401 se channel não existir (Legacy)', async () => {
        req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
        (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue(null);
  
        await authMiddleware(req as Request, res, next);
  
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid Channel Credentials' }));
    });

    it('deve retornar 500 em erro inesperado', async () => {
        req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
        (channelService.findByApiKeyAndSlug as jest.Mock).mockRejectedValue(new Error('DB Error'));
  
        await authMiddleware(req as Request, res, next);
  
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal Auth Error' }));
    });
  });

  // =========================================================================
  // TESTES DO CONTROLLER (createIngestController)
  // =========================================================================
  describe('createIngestController', () => {
    const controller = createIngestController(mockSocketService);

    it('deve retornar 200 em sucesso (Versa)', async () => {
      // Simula middleware passando dados
      res.locals.targetChannel = { slug: 'channel-versa', isActive: true };
      res.locals.authStrategy = 'direct';
      
      const payload = { source_system: 'VersaTest' };
      req.body = payload;

      (PayloadFactory.create as jest.Mock).mockReturnValue({ name: 'João', rawSource: 'Versa', routingKey: 'COL' });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSocketService.broadcastCall).toHaveBeenCalled();
    });

    it('deve retornar 422 se o Zod falhar na Factory', async () => {
      res.locals.targetChannel = { slug: 'channel-test', isActive: true };
      
      const zodError = new Error('ZodError');
      (zodError as any).name = 'ZodError';
      (zodError as any).errors = ['Invalid'];
      
      (PayloadFactory.create as jest.Mock).mockImplementation(() => { throw zodError; });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'Payload inválido' }));
    });

    it('deve retornar 400 se o payload for desconhecido', async () => {
      res.locals.targetChannel = { slug: 'channel-test', isActive: true };
      
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        throw new Error('Formato de payload desconhecido ou não suportado.');
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Formato de payload desconhecido ou não suportado.' }));
    });

    it('deve retornar 500 em erro de processamento genérico', async () => {
        res.locals.targetChannel = { slug: 'channel-test', isActive: true };
        
        // Factory ok
        (PayloadFactory.create as jest.Mock).mockReturnValue({ name: 'João' });
        
        // Erro no socket
        (mockSocketService.broadcastCall as jest.Mock).mockImplementation(() => {
            throw new Error('Socket Error');
        });

        await controller(req as Request, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal Processing Error' }));
    });
  });
});