// src/server/controllers/__tests__/ingest.controller.test.ts

import { Request, Response, NextFunction } from 'express';
import { createIngestController, authMiddleware } from '../ingest.controller';
import { PayloadFactory } from '../../adapters/payload.factory';
import { SocketService } from '../../services/socket.service';
import { channelService } from '../../services/channel.service';

// Mock do Prisma (com call.create como jest.fn()
const mockPrismaCallCreate = jest.fn();

jest.mock('../../config/prisma', () => ({
  prisma: {
    call: {
      create: mockPrismaCallCreate,
    },
  },
}));

jest.mock('../../adapters/payload.factory');
jest.mock('../../services/channel.service');

const mockSocketService = {
  broadcastCall: jest.fn(),
} as unknown as SocketService;

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
        {
          error: 'Bad Request',
          message: 'Headers x-auth-token e x-channel-id são obrigatórios',
        });
    });

    it('deve retornar 401 se channel não existir ou estiver inativo', async () => {
      req.headers = {
        'x-auth-token': 'invalid',
        'x-channel-id': 'invalid',
      };
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue(null);

      await authMiddleware(req as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Token ou canal inválido ou inativo',
      });
    });

    it('deve chamar next() e anexar channel se válido', async () => {
      const channel = { id: '1', slug: 'recepcao', name: 'Recepção' };
      req.headers = {
        'x-auth-token': 'valid-key',
        'x-channel-id': 'recepcao',
      };
      (channelService.findByApiKeyAndSlug as jest.Mock).mockResolvedValue(channel);

      await authMiddleware(req as Request, res, next);

      expect((req as any).channel).toBe(channel);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('createIngestController', () => {
    const controller = createIngestController(mockSocketService);

    beforeEach(() => {
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

      const normalized = {
        name: 'João',
        destination: 'Consultório 1',
        rawSource: 'Versa',
        isPriority: false,
        professional: undefined,
        timestamp: expect.any(Date),
      };

      (PayloadFactory.create as jest.Mock).mockReturnValue(normalized);

      // Aqui está a correção: usamos o mock que criamos acima
      mockPrismaCallCreate.mockResolvedValue({
        id: 'call-123',
        ...normalized,
      });

      await controller(req as Request, res);

      expect(mockPrismaCallCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: '1',
          patientName: 'João',
          destination: 'Consultório 1',
          sourceSystem: 'Versa',
          rawPayload: payload,
        }),
      });

      expect(mockSocketService.broadcastCall).toHaveBeenCalledWith('recepcao', {
        ...normalized,
        id: 'call-123',
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: 'call-123',
          channel: 'recepcao',
          call: normalized,
        },
      });
    });

    it('deve retornar 422 em erro de validação Zod', async () => {
      req.body = { invalid: 'payload' };
      (PayloadFactory.create as jest.Mock).mockImplementation(() => {
        const err = new Error('Required');
        (err as any).name = 'ZodError';
        throw err;
      });

      await controller(req as Request, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payload inválido',
        details: expect.any(Array),
      });
    });
  });
});