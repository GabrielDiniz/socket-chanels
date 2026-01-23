// src/app/panel/_components/layout/PanelHeader.tsx — Cabeçalho com tema claro e relógio

"use client";

import { useEffect, useState } from "react";

interface PanelHeaderProps {
  channelSlug: string;
  isConnected: boolean;
}

export default function PanelHeader({ channelSlug, isConnected }: PanelHeaderProps) {
  const [time, setTime] = useState<string>('');

  // Lógica do relógio isolada no componente de Header
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Formatação amigável do slug
  const displayTitle = channelSlug.replace(/-/g, ' ');

  return (
    <header className="h-24 bg-white flex items-center justify-between px-10 border-b-4 border-[#0078bc] shadow-sm z-20 relative">
      <div className="flex items-center gap-6">
        {/* Indicador de Status Discreto */}
        <div className="flex flex-col items-center justify-center" title={isConnected ? "Online" : "Desconectado"}>
           <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
        </div>
        
        {/* Título do Canal */}
        <h1 className="text-3xl font-bold tracking-tight uppercase text-slate-700">
          <span className="text-[#0078bc]">Painel </span>
          {displayTitle}
        </h1>
      </div>

      {/* Relógio Digital */}
      <div className="text-6xl font-black text-slate-800 tabular-nums tracking-tight">
        {time}
      </div>
    </header>
  );
}