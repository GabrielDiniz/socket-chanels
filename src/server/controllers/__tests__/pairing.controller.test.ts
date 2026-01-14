import { Request, Response } from 'express';
import { createPairingController } from '../pairing.controller';
import { PairingService } from '../../services/pairing.service';
import { channelService } from '../../services/channel.service';
import { logger } from '../../config/logger';

// Mock das dependências externas
jest.mock('../../services/channel.service');
jest.mock('../../config/logger');

describe('PairingController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockPairingService: jest.Mocked<PairingService>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  // Definimos o tipo do controller para ser inicializado no beforeEach
  let controller: (req: Request, res: Response) => Promise<void>;

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnThis();
    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };

    // Criamos o mock do serviço
    mockPairingService = {
      validateCode: jest.fn(),
    } as any;

    // IMPORTANTE: Inicializamos o controller AQUI com o mock atualizado
    controller = createPairingController(mockPairingService);

    jest.clearAllMocks();
  });

  it('deve realizar o pareamento com sucesso (200)', async () => {
    mockRequest = {
      body: { code: '123456', channelSlug: 'tv-sala' },
    };

    (channelService.findBySlug as jest.Mock).mockResolvedValue({
      apiKey: 'valid-api-key',
    });

    await controller(mockRequest as Request, mockResponse as Response);

    expect(channelService.findBySlug).toHaveBeenCalledWith('tv-sala');
    // Agora o mock terá a contagem de chamadas correta
    expect(mockPairingService.validateCode).toHaveBeenCalledWith('123456', 'tv-sala', 'valid-api-key');
    expect(statusSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: 'Pareamento realizado com sucesso',
    });
  });

  it('deve retornar 410 quando o código estiver expirado ou for inválido', async () => {
    mockRequest = {
      body: { code: '123456', channelSlug: 'tv-sala' },
    };

    (channelService.findBySlug as jest.Mock).mockResolvedValue({ apiKey: 'key' });
    
    // Forçamos o erro exato que o controlador espera
    mockPairingService.validateCode.mockImplementation(() => {
      throw new Error('Código inválido ou expirado');
    });

    await controller(mockRequest as Request, mockResponse as Response);

    expect(statusSpy).toHaveBeenCalledWith(410);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: 'Código inválido ou expirado',
    });
  });

  it('deve retornar 500 quando a validação do Zod falhar', async () => {
    mockRequest = {
      body: { code: '123', channelSlug: '' }, // Code inválido (< 6 dígitos)
    };

    await controller(mockRequest as Request, mockResponse as Response);

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Erro interno'),
      })
    );
  });

  it('deve retornar status 404 e interromper a execução quando o canal não existir', async () => {
  // 1. Setup: Request com dados que passam na validação do Zod
  mockRequest = {
    body: { 
      code: '123456', 
      channelSlug: 'slug-inexistente' 
    },
  };

  // 2. Mock: channelService retorna null para simular canal não encontrado
  (channelService.findBySlug as jest.Mock).mockResolvedValue(null);

  // 3. Execução
  await controller(mockRequest as Request, mockResponse as Response);

  // 4. Asserts para cobertura das linhas 20-22
  expect(channelService.findBySlug).toHaveBeenCalledWith('slug-inexistente');
  expect(statusSpy).toHaveBeenCalledWith(404);
  expect(jsonSpy).toHaveBeenCalledWith({ 
    success: false, 
    error: 'Canal não encontrado' 
  });

  // Garante que o pairingService.validateCode NÃO foi chamado após o erro 404
  expect(mockPairingService.validateCode).not.toHaveBeenCalled();
});
});