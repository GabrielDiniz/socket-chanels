import { Server as SocketIOServer } from 'socket.io';
import { SocketService } from '../socket.service';
import { logger } from '../../config/logger';
import { verifyToken } from '../../utils/jwt.utils';
import { channelService } from '../channel.service';

// Mock do logger
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock do JWT Utils
jest.mock('../../utils/jwt.utils', () => ({
  verifyToken: jest.fn(),
}));

// Mock do Channel Service
jest.mock('../channel.service', () => ({
  channelService: {
    findBySlug: jest.fn(),
  },
}));

describe('Socket Service', () => {
  let socketService: SocketService;
  let mockServer: any;
  let middlewareCallback: Function;
  let connectionCallback: Function;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-123',
      // Simula envio de token e slug
      handshake: { 
        auth: { token: 'valid-token', channelSlug: 'sala-1' }, 
        headers: {},
        query: {} 
      },
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    mockServer = {
      use: jest.fn((cb) => {
        middlewareCallback = cb;
      }),
      on: jest.fn((event, cb) => {
        if (event === 'connection') {
          connectionCallback = cb;
        }
      }),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as SocketIOServer;

    // Instancia o serviço
    socketService = new SocketService(mockServer);
  });

  describe('Middleware de Autenticação', () => {
    it('Deve permitir conexão com token válido e canal existente', async () => {
      // Mock canal encontrado
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ 
        slug: 'sala-1', 
        apiKey: 'secret-key-123' 
      });
      // Mock validação token com a key do canal
      (verifyToken as jest.Mock).mockReturnValue({ id: 'user-1' });
      
      const next = jest.fn();

      await middlewareCallback(mockSocket, next);

      expect(channelService.findBySlug).toHaveBeenCalledWith('sala-1');
      expect(verifyToken).toHaveBeenCalledWith('valid-token', 'secret-key-123');
      expect(mockSocket.user).toEqual({ id: 'user-1' });
      expect(next).toHaveBeenCalledWith(); // Sucesso
    });

    it('Deve rejeitar conexão se channelSlug ausente', async () => {
      mockSocket.handshake.auth.channelSlug = null;
      const next = jest.fn();

      await middlewareCallback(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication error: ChannelSlug missing'));
    });

    it('Deve rejeitar conexão se canal não encontrado', async () => {
      (channelService.findBySlug as jest.Mock).mockResolvedValue(null);
      const next = jest.fn();

      await middlewareCallback(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication error: Channel not found'));
    });

    it('Deve rejeitar conexão com token inválido para aquele canal', async () => {
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ apiKey: 'secret' });
      (verifyToken as jest.Mock).mockReturnValue(null); // Falha na verificação
      const next = jest.fn();

      await middlewareCallback(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication error: Invalid token'));
    });
  });

  describe('Eventos de Conexão', () => {
    beforeEach(async () => {
       // Configura ambiente "logado"
      (channelService.findBySlug as jest.Mock).mockResolvedValue({ apiKey: 's' });
      (verifyToken as jest.Mock).mockReturnValue({ id: 'u1' });
      const next = jest.fn();
      if (middlewareCallback) await middlewareCallback(mockSocket, next);
    });

    it('Deve logar conexão', () => {
      if (connectionCallback) connectionCallback(mockSocket);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Socket] Conectado'),
        expect.objectContaining({ socketId: 'socket-123' })
      );
    });
    
    it('broadcastCall deve emitir call_update para room específica', () => {
        const data = { id: '1', name: 'Teste' };
        socketService.broadcastCall('triagem-02', data);
    
        expect(mockServer.to).toHaveBeenCalledWith('triagem-02');
        expect(mockServer.emit).toHaveBeenCalledWith('call_update', data);
    });
  });
});