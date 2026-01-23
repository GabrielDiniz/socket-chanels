// src/app/panel/_components/layout/PanelFooter.tsx — Rodapé técnico

"use client";

interface PanelFooterProps {
  channelSlug: string;
  isConnected: boolean;
  onClearPairing: () => void;
  lastCallId?: string;
}

export default function PanelFooter({ channelSlug, isConnected, onClearPairing, lastCallId }: PanelFooterProps) {
  return (
    <footer className="h-10 bg-white flex items-center justify-between px-6 text-[11px] text-slate-500 uppercase tracking-wider border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
      <div className="flex gap-6 font-medium">
         <span className="flex items-center gap-2">
           Status: 
           <span className={isConnected ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
             {isConnected ? 'ONLINE' : 'OFFLINE'}
           </span>
         </span>
         <span>Canal: {channelSlug}</span>
         <span className="text-slate-400">ID: {lastCallId?.slice(0, 8) || '---'}</span>
      </div>
      
      <button 
        onClick={onClearPairing} 
        className="hover:text-red-600 transition-colors font-bold opacity-60 hover:opacity-100"
      >
        Configurações / Desparear
      </button>
    </footer>
  );
}