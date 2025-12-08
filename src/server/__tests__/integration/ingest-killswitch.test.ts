import { Request, Response, NextFunction } from 'express';
import { createIngestController, authMiddleware } from '../../controllers/ingest.controller';
import { prisma } from '../../config/prisma';
import { PayloadFactory } from '../../adapters/payload.factory';
import { channelService } from '../../services/channel.service';
import type { SocketService } from '../../services/socket.service';

// Mocks definidos diretamente
jest.mock('../../config/prisma', () => ({
  __esModule: true,
  prisma: {
    call: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../adapters/payload.factory');
jest.mock('../../services/channel.service');

// Mock do serviço de Socket
const mockSocketService = {
  broadcastCall: jest.fn(),
} as unknown as SocketService;

// Helper para response
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
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

  describe('authMiddleware', () => {
    it('deve chamar next() se autenticado e tenant ativo', async () => {
      req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
      // Mock canal COM tenant ativo
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue({ 
        id: '1', 
        tenant: { isActive: true } 
      });
      await authMiddleware(req as Request, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('deve retornar 403 se tenant estiver inativo (Kill Switch)', async () => {
      req.headers = { 'x-auth-token': 'key', 'x-channel-id': 'slug' };
      // Mock canal COM tenant inativo
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue({ 
        id: '1', 
        tenant: { isActive: false, name: 'Caloteiro' } 
      });
      
      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Forbidden' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 400 se faltar headers obrigatórios', async () => {
      await authMiddleware(req as Request, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Bad Request' })
      );
    });

    it('deve retornar 401 se channel não existir ou estiver inativo', async () => {
      req.headers = {
        'x-auth-token': 'invalid-key',
        'x-channel-id': 'invalid-slug',
      };
      
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue(null);

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
    });

    it('deve retornar 500 em erro inesperado', async () => {
      req.headers = {
        'x-auth-token': 'valid-key',
        'x-channel-id': 'recepcao',
      };    
      (channelService.findByApiKeyAndSlug as jest.Mock).mockRejectedValue(new Error('DB down'));
      await authMiddleware(req as Request, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Internal Server Error' })
      );
    });
  });

  describe('createIngestController', () => {
    const controller = createIngestController(mockSocketService);

    beforeEach(() => {
      // Simula estado autenticado
      (req as any).channel = { id: '1', slug: 'recepcao', name: 'Recepção' };
    });

    // --- Casos para Versa ---
    it('deve retornar 200 em sucesso (Versa)', async () => {
      req.body = { valid: 'payload' };
      (PayloadFactory.create as jest.Mock).mockReturnValue({ name: 'Test', destination: 'Dest', rawSource: 'Versa' });
      (prisma.call.create as jest.Mock).mockResolvedValue({ id: '123' });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(prisma.call.create).toHaveBeenCalled();
      expect(mockSocketService.broadcastCall).toHaveBeenCalled();
    });

    // --- Casos para NovoSGA ---
    it('deve processar e retornar 200 para payload válido do NovoSGA', async () => {
      const sgaPayload = {
        senha: { format: 'A005' },
        local: { nome: 'Guichê' },
        numeroLocal: 3,
        prioridade: { peso: 1 }, // Prioritário
      };
      req.body = sgaPayload;

      // Mock do que a Factory retornaria para um payload SGA
      const normalizedSgaCall = {
        name: 'A005',
        destination: 'Guichê 3',
        rawSource: 'NovoSGA',
        isPriority: true,
        timestamp: new Date(),
      };

      (PayloadFactory.create as jest.Mock).mockReturnValue(normalizedSgaCall);
      (prisma.call.create as jest.Mock).mockResolvedValue({ id: 'sga-123' });

      await controller(req as Request, res);

      // Verificações
      expect(PayloadFactory.create).toHaveBeenCalledWith(sgaPayload);
      
      expect(prisma.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: '1',
          patientName: 'A005',
          destination: 'Guichê 3',
          isPriority: true,
          sourceSystem: 'NovoSGA',
          ticket: 'A005', // Controller deve usar o nome como ticket para SGA
          rawPayload: sgaPayload
        })
      });

      expect(mockSocketService.broadcastCall).toHaveBeenCalledWith('recepcao', expect.objectContaining({
        id: 'sga-123',
        name: 'A005',
        rawSource: 'NovoSGA'
      }));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('deve retornar 422 se o Zod falhar na Factory', async () => {
      req.body = { invalid: 'payload' };
      
      // Simula erro do Zod lançado pela Factory
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        const err = new Error('Zod Validation Error');
        (err as any).name = 'ZodError';
        (err as any).errors = [{ path: ['field'], message: 'Required' }];
        throw err;
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ 
          success: false, 
          error: 'Payload inválido',
          details: expect.any(Array) 
        })
      );
    });

    it('deve retornar 400 se o payload for desconhecido (Regra de Negócio)', async () => {
      req.body = { unknown: 'system' };
      
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        throw new Error('Formato de payload desconhecido ou não suportado.');
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ 
          success: false, 
          error: 'Formato de payload desconhecido ou não suportado.' 
        })
      );
    });

    it('deve retornar 400 se o payload não corresponder a nenhum padrão conhecido', async () => {
      // Payload que não é Versa nem SGA
      const unknownPayload = { foo: 'bar' };
      req.body = unknownPayload;

      // A Factory deve lançar erro para payload desconhecido
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        throw new Error('Formato de payload desconhecido ou não suportado.');
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Formato de payload desconhecido ou não suportado.'
        })
      );
    });

    it('deve retornar 500 em erro de banco de dados (Prisma)', async () => {
        const payload = {
            source_system: 'VersaTest',
            current_call: { patient_name: 'João', destination: 'Consultório 1' },
        };
        req.body = payload;

        // Factory passa ok
        (PayloadFactory.create as jest.Mock).mockReturnValue({ name: 'João' }); 
        
        // Prisma falha
        (prisma.call.create as jest.Mock).mockRejectedValue(new Error('DB Connection Error'));

        await controller(req as Request, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ 
              success: false, 
              error: 'Erro interno ao processar chamada' 
            })
        );
    });
  });
});