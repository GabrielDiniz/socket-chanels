import { Server as SocketIOServer } from 'socket.io';
import { SocketService } from '../socket.service';
import { logger } from '../../config/logger';

// Mock do logger
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Socket Service', () => {
  let socketService: SocketService;
  let mockServer: any;
  let connectionCallback: Function;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    };

    mockServer = {
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

  it('Constructor deve inicializar io e setup logs de conexão', () => {
    expect(mockServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('Deve logar conexão e registrar eventos do socket ao conectar', () => {
    // Simula a conexão executando o callback capturado
    if (connectionCallback) {
        connectionCallback(mockSocket);
    } else {
        fail('Callback de conexão não foi capturado');
    }

    // Verifica log de conexão.
    // Usamos stringContaining para ser menos rígido quanto à formatação exata.
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('[Socket] Conectado'),
      expect.any(Object)
    );

    // Verifica se registrou os listeners no socket cliente
    expect(mockSocket.on).toHaveBeenCalledWith('join_channel', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('Deve entrar na sala (join) e logar quando cliente emite join_channel', () => {
    // 1. Conecta
    if (connectionCallback) {
        connectionCallback(mockSocket);
    }

    // Limpa mocks para focar nos logs do evento join
    (logger.debug as jest.Mock).mockClear();

    // 2. Recupera o callback registrado para 'join_channel'
    // A implementação do mockSocket.on é: on(event, callback)
    // Então procuramos a chamada onde o primeiro argumento é 'join_channel'
    const joinCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'join_channel');
    
    if (!joinCall) {
        fail('Listener para join_channel não foi registrado');
        return; 
    }
    
    const joinCallback = joinCall[1];

    // 3. Executa o callback simulando o evento do cliente
    joinCallback('recepcao-01');

    // 4. Verificações
    expect(mockSocket.join).toHaveBeenCalledWith('recepcao-01');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Entrou na sala'),
      expect.objectContaining({ channel: 'recepcao-01' })
    );
  });

  it('Deve logar disconnect corretamente', () => {
    if (connectionCallback) {
        connectionCallback(mockSocket);
    }

    (logger.debug as jest.Mock).mockClear();

    const disconnectCall = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'disconnect');
    
    if (!disconnectCall) {
        fail('Listener para disconnect não foi registrado');
        return;
    }

    const disconnectCallback = disconnectCall[1];

    disconnectCallback(); // Simula desconexão

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Desconectado'),
      expect.objectContaining({ socketId: 'socket-123' })
    );
  });

  it('broadcastCall deve emitir call_update para room específica', () => {
    const data = { id: '1', name: 'Teste' };
    socketService.broadcastCall('triagem-02', data);

    expect(mockServer.to).toHaveBeenCalledWith('triagem-02');
    expect(mockServer.emit).toHaveBeenCalledWith('call_update', data);
  });

  it('Deve não emitir se room inválida (edge case)', () => {
    socketService.broadcastCall('', { test: true });
    
    expect(mockServer.to).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Tentativa de broadcast'),
      expect.any(Object)
    );
  });
});