import { Request, Response, NextFunction } from 'express';
import { createIngestController, authMiddleware } from '../ingest.controller';
// Importamos as dependências reais para usar como "handles" para os mocks
import { prisma } from '../../config/prisma';
import { PayloadFactory } from '../../adapters/payload.factory';
import { channelService } from '../../services/channel.service';
import type { SocketService } from '../../services/socket.service';

// 1. Mocks definidos diretamente no factory para evitar ReferenceError (Hoisting)
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

// Mock simples para o serviço de Socket (que é injetado, não importado)
const mockSocketService = {
  broadcastCall: jest.fn(),
} as unknown as SocketService;

// Helper para criar response mockado
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
    req = {
      headers: {},
      body: {},
    };
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
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
      
      // Configuramos o mock importado
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue(null);

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
    });

    it('deve chamar next() e anexar channel se válido', async () => {
      const mockChannel = { id: '1', slug: 'recepcao', name: 'Recepção' };
      req.headers = {
        'x-auth-token': 'valid-key',
        'x-channel-id': 'recepcao',
      };
      
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue(mockChannel);

      await authMiddleware(req as Request, res, next);

      // Verifica se o canal foi anexado à requisição
      expect((req as any).channel).toEqual(mockChannel);
      expect(next).toHaveBeenCalled();
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
    // Cria o controller injetando o mock do socket
    const controller = createIngestController(mockSocketService);

    beforeEach(() => {
      // Simula o estado após o middleware de auth ter rodado com sucesso
      req.headers = {
        'x-auth-token': 'valid',
        'x-channel-id': 'recepcao',
      };
      (req as any).channel = { id: '1', slug: 'recepcao', name: 'Recepção' };
    });

    it('deve processar chamada válida, persistir e broadcastar', async () => {
      const payload = {
        source_system: 'VersaTest',
        current_call: { patient_name: 'João', destination: 'Consultório 1' },
      };
      req.body = payload;

      const normalizedCall = {
        name: 'João',
        destination: 'Consultório 1',
        rawSource: 'Versa',
        isPriority: false,
        professional: undefined,
        timestamp: new Date(),
      };

      // Mock da Factory e do Prisma
      (PayloadFactory.create as jest.Mock).mockReturnValue(normalizedCall);
      (prisma.call.create as jest.Mock).mockResolvedValue({
        id: 'call-uuid-123',
        ...normalizedCall,
      });

      await controller(req as Request, res);

      // 1. Verifica persistência
      expect(prisma.call.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: '1',
          patientName: 'João',
          destination: 'Consultório 1',
          rawPayload: payload,
        }),
      });

      // 2. Verifica broadcast via Socket
      expect(mockSocketService.broadcastCall).toHaveBeenCalledWith('recepcao', {
        ...normalizedCall,
        id: 'call-uuid-123',
      });

      // 3. Verifica resposta HTTP
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('deve retornar 422 em erro de validação Zod', async () => {
      req.body = { invalid: 'payload' };
      
      // Simula erro do Zod lançado pela Factory
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        const err = new Error('Required');
        (err as any).name = 'ZodError';
        (err as any).errors = [];
        throw err;
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Payload inválido' })
      );
    });

    it('deve retornar 400 em erro genérico', async () => {
      req.body = { valid: 'payload' };
      
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        throw new Error('Erro desconhecido');
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });
  });
});