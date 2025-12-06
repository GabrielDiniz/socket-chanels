// src/server/services/__tests__/socket.service.test.ts

import { Server as SocketIOServer } from 'socket.io';
import { SocketService } from '../socket.service';

// Mock do socket.io
const mockIo = {
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  engine: { clientsCount: 5 },
};

const mockSocket = {
  id: 'socket-123',
  join: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
};

describe('Socket Service', () => {
  let socketService: SocketService;
  let mockServer: any;

  beforeEach(() => {
    mockServer = mockIo as unknown as SocketIOServer;
    socketService = new SocketService(mockServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Constructor deve inicializar io e setup logs de conexão', () => {
    expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('Deve logar conexão e join_channel ao receber evento', () => {
    const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    connectionHandler(mockSocket);

    expect(consoleLogSpy).toHaveBeenCalledWith('[Socket] Conectado: socket-123');

    const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_channel')[1];
    joinHandler('recepcao-01');

    expect(mockSocket.join).toHaveBeenCalledWith('recepcao-01');
    expect(consoleLogSpy).toHaveBeenCalledWith('[Socket] socket-123 entrou em: recepcao-01');

    consoleLogSpy.mockRestore();
  });

  it('Deve logar disconnect corretamente', () => {
    const connectionHandler = mockIo.on.mock.calls[0][1];
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    connectionHandler(mockSocket);

    const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
    disconnectHandler();

    expect(consoleLogSpy).toHaveBeenCalledWith('[Socket] Desconectado: socket-123');

    consoleLogSpy.mockRestore();
  });

  it('broadcastCall deve emitir call_update para room específica', () => {
    socketService.broadcastCall('triagem-02', { patientName: 'João' });

    expect(mockIo.to).toHaveBeenCalledWith('triagem-02');
    expect(mockIo.emit).toHaveBeenCalledWith('call_update', { patientName: 'João' });
  });

  it('Deve não emitir se room inválida (edge case)', () => {
    socketService.broadcastCall('', { test: true });
    socketService.broadcastCall(null as any, { test: true });

    expect(mockIo.to).not.toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});