// src/app/panel/_components/CallCard.tsx — Card de chamada com separação inteligente de Local e Número no histórico

"use client";

import { useEffect, useState } from 'react';
import { CallData } from '../../../hooks/useSocket';

interface CallCardProps {
  data: CallData;
  isMain?: boolean;
}

export default function CallCard({ data, isMain = false }: CallCardProps) {
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), 3000);
    return () => clearTimeout(timer);
  }, [data.id]);

  const mainDisplay = data.ticket || data.name;
  const isTicket = data.rawSource === 'NovoSGA' || mainDisplay.length <= 5;
  const labelText = isTicket ? 'Senha' : 'Paciente';
  
  // Cores baseadas no tema claro #0078bc
  const priorityColor = data.isPriority ? 'text-red-600' : 'text-[#0078bc]';
  
  // === Lógica de Separação (Nome do Local vs Número) ===
  // Remove números para pegar o nome (ex: "Consultório 05" -> "Consultório")
  const destinationName = data.destination.replace(/[0-9]/g, '').trim() || 'Sala';
  
  // Pega apenas números ou usa o texto completo se não houver números (fallback)
  // ex: "Consultório 05" -> "05" | "Recepção" -> "Recepção"
  const destinationNumber = data.destination.replace(/[^0-9]/g, '') || data.destination.substring(0, 4);

  // === LAYOUT PRINCIPAL (Gigante) ===
  if (isMain) {
    return (
      <div className={`
        w-full max-w-6xl mx-auto flex flex-col gap-8 text-center
        transition-all duration-500 ease-out p-12 rounded-3xl
        ${highlight ? 'scale-105 shadow-2xl bg-white ring-4 ring-blue-100' : 'scale-100 shadow-soft bg-white'}
      `}>
        <div className="flex flex-col items-center w-full relative z-10">
          
          {data.isPriority && (
            <div className="bg-red-100 text-red-700 px-8 py-2 rounded-full font-bold uppercase tracking-widest text-xl mb-6 animate-pulse border border-red-200">
              Atendimento Prioritário
            </div>
          )}

          <div className="space-y-4 mb-10 w-full border-b border-slate-100 pb-8">
            <span className={`block text-2xl font-bold uppercase tracking-[0.3em] ${priorityColor}`}>
              {labelText}
            </span>
            <h1 className={`font-black text-slate-900 leading-tight break-words
              ${isTicket ? 'text-[10rem] tracking-tighter' : 'text-7xl md:text-8xl'}
            `}>
              {mainDisplay}
            </h1>
          </div>

          <div className="w-full bg-[#0078bc] text-white px-10 py-10 rounded-2xl shadow-lg transform transition-transform">
            <span className="block text-xl font-medium text-blue-100 uppercase tracking-widest mb-2">
              Dirija-se para
            </span>
            <div className="text-6xl md:text-8xl font-black leading-none drop-shadow-md">
              {data.destination}
            </div>
          </div>

          {data.professional && (
            <div className="mt-8 text-slate-500 font-medium text-2xl flex items-center justify-center gap-3">
              <span className="opacity-60 uppercase text-lg tracking-wider">Profissional</span>
              <span className="text-slate-800 font-bold">{data.professional}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === LAYOUT HISTÓRICO (Lateral) ===
  return (
    <div className={`
      bg-white p-5 flex flex-col shadow-sm relative overflow-hidden group 
      border-l-8 transition-all duration-300 hover:shadow-md hover:translate-x-1
      ${data.isPriority ? 'border-red-500' : 'border-[#0078bc]'}
    `}>
      <div className="flex justify-between items-center">
        {/* Esquerda: Paciente / Senha */}
        <div className="flex flex-col gap-1 min-w-0 pr-4 flex-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            {labelText}
          </span>
          <span className={`font-bold text-slate-800 truncate w-full block 
            ${isTicket ? 'text-3xl text-slate-900 tracking-tight' : 'text-xl'}
          `}>
            {mainDisplay}
          </span>
          {data.isPriority && (
             <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Prioridade</span>
          )}
        </div>
        
        {/* Direita: Local (Nome em cima, Número grande embaixo) */}
        <div className="text-right whitespace-nowrap pl-4 border-l border-slate-100 min-w-[80px]">
          {/* Nome do Local (ex: Consultório) */}
          <span className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1 truncate max-w-[100px] ml-auto">
            {destinationName}
          </span>
          {/* Número do Local (ex: 05) */}
          <div className={`text-2xl font-black leading-none ${data.isPriority ? 'text-red-600' : 'text-[#0078bc]'}`}>
            {destinationNumber}
          </div>
        </div>
      </div>
    </div>
  );
}