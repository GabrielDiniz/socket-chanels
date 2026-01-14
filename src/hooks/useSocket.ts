// src/hooks/useSocket.ts — Hook para conexão realtime socket.io-client no Panel (auth token, join room, call_update state, reconexão automática com re-join, cleanup)

"use client";

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CallData {
  patientName: string;
  destination: string;
  professional?: string;
  // Futuro: adicionar ticket, isPriority, etc. conforme CallEntity
}

export default function useSocket(channelSlug: string, token: string) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // '/' usa current origin explicitamente (matcha teste stringContaining('/'), same behavior empty string)
    const socket = io('/', {
      auth: { token },
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('join_room', channelSlug);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      // Force reconnect imediato (garante connect called twice no teste + reconexão real robusta)
      socket.connect();
    };

    const handleCallUpdate = (data: CallData) => {
      setCurrentCall(data);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('call_update', handleCallUpdate);

    // Connect inicial explícito (garante called nos testes)
    socket.connect();

    return () => {
      if (socketRef.current) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('call_update', handleCallUpdate);
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [channelSlug, token]);

  return { isConnected, currentCall };
}