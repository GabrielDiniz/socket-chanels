// src/app/panel/_components/ActiveView.tsx — View Principal (Orquestrador)

"use client";

import { useEffect, useState } from 'react';
import useSocket, { CallData } from '../../../hooks/useSocket';
import CallCard from './CallCard';
import PanelHeader from './layout/PanelHeader';
import PanelSidebar from './layout/PanelSidebar';
import PanelFooter from './layout/PanelFooter';

interface ActiveViewProps {
  channelSlug: string;
  token: string;
  clearPairing: () => void;
}

export default function ActiveView({ channelSlug, token, clearPairing }: ActiveViewProps) {
  const { isConnected, currentCall } = useSocket(channelSlug, token);
  const [history, setHistory] = useState<CallData[]>([]);

  // Gerenciamento de Histórico e Deduplicação
  useEffect(() => {
    if (currentCall) {
      setHistory((prev) => {
        // Evita duplicar a chamada se o ID for o mesmo
        const exists = prev.some(call => call.id === currentCall.id);
        if (exists) return prev;
        
        // Mantém as últimas 6 chamadas (1 atual + 5 histórico)
        return [currentCall, ...prev].slice(0, 6);
      });
    }
  }, [currentCall]);

  // Filtra a chamada atual do histórico para não repetir na lateral
  const sidebarHistory = history.filter(call => call.id !== currentCall?.id);

  return (
    <div className="h-screen w-full bg-slate-50 overflow-hidden flex flex-col font-sans">
      
      {/* 1. Header (Topo) */}
      <PanelHeader channelSlug={channelSlug} isConnected={isConnected} />

      {/* 2. Main Layout (Grid) */}
      <main className="flex-1 grid grid-cols-12 overflow-hidden">
        
        {/* Área Principal: Chamada Atual (8 colunas) */}
        <section className="col-span-8 flex flex-col justify-center items-center relative p-12 bg-pattern-grid">
          {/* Background decorativo sutil */}
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-50 pointer-events-none" />
          
          {currentCall ? (
            <div className="z-10 w-full">
              <CallCard data={currentCall} isMain={true} />
            </div>
          ) : (
            <div className="flex flex-col items-center opacity-40 space-y-6 animate-pulse z-10">
               <svg className="w-32 h-32 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
               </svg>
              <p className="text-3xl font-light tracking-[0.2em] uppercase text-slate-400">
                Aguardando Chamada...
              </p>
            </div>
          )}
        </section>

        {/* Área Lateral: Histórico (4 colunas) */}
        <PanelSidebar history={sidebarHistory} />

      </main>

      {/* 3. Footer (Rodapé) */}
      <PanelFooter 
        channelSlug={channelSlug} 
        isConnected={isConnected} 
        onClearPairing={clearPairing}
        lastCallId={currentCall?.id}
      />
    </div>
  );
}