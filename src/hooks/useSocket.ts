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
    if (!token || !channelSlug) return;

    // '/' usa current origin explicitamente
    const socket = io('/', {
      auth: { token },
      query: { channelSlug }, // Envia slug no handshake também para redundância/logs
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      // CORREÇÃO: Nome do evento alterado de 'join_room' para 'join_channel' para bater com o backend
      socket.emit('join_channel', channelSlug);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      // Tenta reconectar se cair
      if (socket.connected === false) {
        socket.connect();
      }
    };

    const handleCallUpdate = (data: CallData) => {
      console.log('[useSocket] Nova chamada recebida:', data);
      setCurrentCall(data);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('call_update', handleCallUpdate);

    // Connect inicial explícito
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