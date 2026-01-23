// src/app/panel/_components/layout/PanelSidebar.tsx — Barra lateral de histórico

"use client";

import { CallData } from "../../../../hooks/useSocket";
import CallCard from "../CallCard";

interface PanelSidebarProps {
  history: CallData[];
}

export default function PanelSidebar({ history }: PanelSidebarProps) {
  return (
    <aside className="col-span-4 bg-slate-50 flex flex-col border-l border-slate-200 h-full">
      {/* Cabeçalho da Sidebar */}
      <div className="bg-white p-6 shadow-sm border-b border-slate-200 z-10">
        <h2 className="text-lg font-bold uppercase tracking-wider text-[#0078bc] text-center flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Últimas Chamadas
        </h2>
      </div>
      
      {/* Lista de Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-300">
        {history.length > 0 ? (
          history.map((call) => (
            <div key={call.id} className="opacity-80 hover:opacity-100 transition-opacity duration-300">
              <CallCard data={call} isMain={false} />
            </div>
          ))
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-lg m-4">
            <span className="text-4xl opacity-30">•</span>
            <span className="text-sm font-medium">Histórico vazio</span>
          </div>
        )}
      </div>

      {/* Rodapé da Sidebar (Decorativo) */}
      <div className="p-4 bg-slate-100 text-center border-t border-slate-200">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Histórico Recente
         </span>
      </div>
    </aside>
  );
}