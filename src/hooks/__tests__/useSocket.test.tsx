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

  it('Deve inicializar socket e conectar com auth token do pairing', () => {
    const { result } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    expect(socketIoMock).toHaveBeenCalledWith(expect.stringContaining('/'), expect.objectContaining({
      auth: { token: 'stub-token' },
    }));
    expect(mockedSocket.connect).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it('Deve join room channelSlug on connect', () => {
    const { result, rerender } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    act(() => {
      const connectCallback = mockedSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectCallback?.();
      mockedSocket.connected = true;
    });

    rerender();

    expect(mockedSocket.emit).toHaveBeenCalledWith('join_room', 'recepcao-principal');
    expect(result.current.isConnected).toBe(true);
  });

  it('Deve atualizar currentCall no evento call_update', () => {
    const { result, rerender } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    const mockCall = { patientName: 'João Silva', destination: 'Consultório 3', professional: 'Dr. Maria' };

    act(() => {
      const updateCallback = mockedSocket.on.mock.calls.find(call => call[0] === 'call_update')?.[1];
      updateCallback?.(mockCall);
    });

    rerender();

    expect(result.current.currentCall).toEqual(mockCall);
  });

  it('Deve reconectar automaticamente e re-join room em disconnect', () => {
    const { result, rerender } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    act(() => {
      // Simula connect inicial
      const connectCallback = mockedSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      connectCallback?.();
      mockedSocket.connected = true;
    });

    act(() => {
      // Simula disconnect
      const disconnectCallback = mockedSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
      disconnectCallback?.();
      mockedSocket.connected = false;
    });

    rerender();

    expect(mockedSocket.connect).toHaveBeenCalledTimes(2); // Inicial + reconnect
    expect(result.current.isConnected).toBe(false);
    // Re-join após reconnect
    act(() => {
      const reconnectCallback = mockedSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      reconnectCallback?.();
    });
    expect(mockedSocket.emit).toHaveBeenCalledWith('join_room', 'recepcao-principal');
  });

  it('Deve cleanup listeners e disconnect on unmount', () => {
    const { unmount } = renderHook(() => useSocket('recepcao-principal', 'stub-token'));

    unmount();

    expect(mockedSocket.off).toHaveBeenCalled();
    expect(mockedSocket.disconnect).toHaveBeenCalled();
  });
});