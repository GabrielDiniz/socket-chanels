// src/hooks/useSocket.test.tsx — Testes unitários TDD para useSocket (conexão realtime socket.io-client, auth token, join room, eventos call_update, reconexão, cleanup)

import { renderHook, act } from '@testing-library/react';
import { io as socketIoMock, Socket } from 'socket.io-client';
import useSocket from '../useSocket';

jest.mock('socket.io-client');

const mockedSocket = {
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  connected: false,
  id: 'socket-test-id',
} as unknown as Socket;

(socketIoMock as jest.Mock).mockReturnValue(mockedSocket);

describe('useSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSocket.connected = false;
  });

  // NOVO TESTE: Cobre a linha 23 (Early return se faltar parâmetros)
  it('Não deve conectar se token ou channelSlug forem inválidos (vazios)', () => {
    // Caso 1: Ambos vazios
    renderHook(() => useSocket('', ''));
    
    // Caso 2: Apenas slug
    renderHook(() => useSocket('slug-valido', ''));

    // Caso 3: Apenas token
    renderHook(() => useSocket('', 'token-valido'));

    // O socketIoMock (io) não deve ser chamado em nenhum desses casos
    expect(socketIoMock).not.toHaveBeenCalled();
  });

  it('Deve inicializar socket e conectar com auth token do pairing', () => {
    renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    expect(socketIoMock).toHaveBeenCalledWith(expect.stringContaining('/'), expect.objectContaining({
      auth: { token: 'stub-token' },
    }));
    expect(mockedSocket.connect).toHaveBeenCalled();
  });

  it('Deve join channel channelSlug on connect', () => {
    renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    act(() => {
      // Simula evento de connect disparado pelo socket
      const connectCallback = (mockedSocket.on as jest.Mock).mock.calls.find(call => call[0] === 'connect')?.[1];
      connectCallback?.();
    });

    expect(mockedSocket.emit).toHaveBeenCalledWith('join_channel', 'recepcao-principal');
  });

  it('Deve atualizar lastCall ao receber call_update', () => {
    const { result } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    const mockCall = {
      patientName: 'João Silva',
      destination: 'Consultório 1',
    };

    act(() => {
      const updateCallback = (mockedSocket.on as jest.Mock).mock.calls.find(call => call[0] === 'call_update')?.[1];
      updateCallback?.(mockCall);
    });

    expect(result.current.lastCall).toEqual(mockCall);
  });

  it('Deve executar callback onCallReceived (se fornecido) ao receber call_update', () => {
    const onCallReceivedMock = jest.fn();
    
    renderHook(() => useSocket('recepcao-principal', 'stub-token', onCallReceivedMock));

    const mockCall = {
      patientName: 'Maria Souza',
      destination: 'Triagem',
    };

    act(() => {
      const updateCallback = (mockedSocket.on as jest.Mock).mock.calls.find(call => call[0] === 'call_update')?.[1];
      updateCallback?.(mockCall);
    });

    expect(onCallReceivedMock).toHaveBeenCalledWith(mockCall);
    expect(onCallReceivedMock).toHaveBeenCalledTimes(1);
  });

  it('Deve reconectar automaticamente e re-join room em disconnect', () => {
    const { result } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    // Resetamos para ignorar a chamada do connect inicial do useEffect
    (mockedSocket.connect as jest.Mock).mockClear();

    act(() => {
      // Simula disconnect
      const disconnectCallback = (mockedSocket.on as jest.Mock).mock.calls.find(call => call[0] === 'disconnect')?.[1];
      mockedSocket.connected = false;
      disconnectCallback?.();
    });

    expect(mockedSocket.connect).toHaveBeenCalledTimes(1); 
    expect(result.current.isConnected).toBe(false);

    act(() => {
      const connectCallback = (mockedSocket.on as jest.Mock).mock.calls.find(call => call[0] === 'connect')?.[1];
      connectCallback?.();
    });
    
    expect(mockedSocket.emit).toHaveBeenCalledWith('join_channel', 'recepcao-principal');
  });

  it('Deve cleanup listeners e disconnect on unmount', () => {
    const { unmount } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    unmount();

    expect(mockedSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockedSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockedSocket.off).toHaveBeenCalledWith('call_update', expect.any(Function));
    expect(mockedSocket.disconnect).toHaveBeenCalled();
  });
});