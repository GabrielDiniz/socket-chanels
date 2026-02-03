// src/hooks/useSocket.ts — Responsável APENAS pela conexão WebSocket e entrega de dados (SRP)
"use client";

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { CallData } from '../types/CallData';

interface UseSocketReturn {
  isConnected: boolean;
  lastCall: CallData | null;
}

export default function useSocket(
  channelSlug: string, 
  token: string, 
  onCallReceived?: (data: CallData) => void
): UseSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastCall, setLastCall] = useState<CallData | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || !channelSlug) return;

    const socket = io('/', {
      auth: { token },
      query: { channelSlug },
    });
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('join_channel', channelSlug);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      // Tentativa de reconexão manual se cair
      if (socket.connected === false) {
        socket.connect();
      }
    };

    const handleCallUpdate = (data: CallData) => {
      console.log('[useSocket] Dados recebidos:', data);
      setLastCall(data);
      
      // Delega a ação para quem está consumindo o hook (Inversão de Controle)
      if (onCallReceived) {
        onCallReceived(data);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('call_update', handleCallUpdate);

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
  }, [channelSlug, token, onCallReceived]);

  return { isConnected, lastCall };
}