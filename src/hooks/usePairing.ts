// src/hooks/usePairing.ts — Hook para gerenciar o pareamento da TV (gera código aleatório + countdown, socket temp room escuta 'paired' do admin, persiste paired realtime)

"use client";

import { env } from 'process';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface PairedData {
  slug: string;
  token: string; // apiKey do channel (pra socket realtime futura)
}

export default function usePairing() {
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [channelSlug, setChannelSlug] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5min countdown
  const socketRef = useRef<Socket | null>(null);

  // Carrega paired existente ou gera code novo
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pairedChannel');
      if (stored) {
        const data: PairedData = JSON.parse(stored);
        setIsPaired(true);
        setChannelSlug(data.slug);
      } else {
        generateNewCode();
      }
    } catch (err) {
      console.warn('[usePairing] Erro localStorage', err);
      localStorage.removeItem('pairedChannel');
      generateNewCode();
    }
  }, []);

  // Countdown timer (reset on new code)
  useEffect(() => {
    if (!isPaired && generatedCode) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            generateNewCode(); // Expira → novo code
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isPaired, generatedCode]);

  // Socket temp room pra pairing realtime (join pairing-{code}, escuta 'paired' do admin)
  useEffect(() => {
    if (!isPaired && generatedCode) {
      // Cleanup socket antigo se existir (new code)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socket = io(process.env.SERVER_URL, {}); // No auth for temp room (public pairing)
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log(`[usePairing] Socket conectado para pairing temp room (code: ${generatedCode})`);
        
        socket.emit('waiting_pair', `${generatedCode}`);
        socket.emit('register_temp_code', { code: generatedCode });
      });

      socket.on('paired', (data: PairedData) => {
        localStorage.setItem('pairedChannel', JSON.stringify(data));
        setIsPaired(true);
        setChannelSlug(data.slug);
        setGeneratedCode('');
        socket.disconnect(); // Cleanup após paired
      });

      socket.connect();

      return () => {
        if (socketRef.current) {
          socket.off('connect');
          socket.off('paired');
          socket.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, [isPaired, generatedCode]);

  // Gera código aleatório 6 dígitos (MVP simple, futuro crypto.getRandomValues)
  const generateNewCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setTimeLeft(300);
  };

  // Stub paired success (manual test or backend fallback)
  const stubPairSuccess = (slug: string = 'recepcao-principal') => {
    const pairedData: PairedData = {
      slug,
      token: 'stub-token',
    };
    localStorage.setItem('pairedChannel', JSON.stringify(pairedData));
    setIsPaired(true);
    setChannelSlug(slug);
    setGeneratedCode('');
  };

  // Clear para test/desparear
  const clearPairing = () => {
    localStorage.removeItem('pairedChannel');
    setIsPaired(false);
    setChannelSlug(null);
    generateNewCode();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return {
    generatedCode,
    isPaired,
    channelSlug,
    timeLeft,
    formatTime,
    generateNewCode,
    stubPairSuccess,
    clearPairing,
  };
}