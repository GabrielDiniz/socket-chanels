// src/app/panel/_components/CallCard.tsx — Card de chamada (Imports atualizados)
"use client";

import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { CallData } from '../../../types/CallData'; // Import corrigido

interface CallCardProps {
  data: CallData;
  isMain?: boolean;
}

export default function CallCard({ data, isMain = false }: CallCardProps) {
  const [highlight, setHighlight] = useState(false);
  
  // Refs e States para o ajuste automático de fonte
  const textRef = useRef<HTMLHeadingElement>(null);
  const [isFontReady, setIsFontReady] = useState(false);

  useEffect(() => {
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), 3000);
    return () => clearTimeout(timer);
  }, [data.id]);

  const mainDisplay = data.ticket || data.name;
  
  // Verifica se é uma senha (lógica visual do card)
  const isTicket = data.rawSource === 'NovoSGA' || (mainDisplay && mainDisplay.length <= 5 && /\d/.test(mainDisplay));
  const labelText = isTicket ? 'Senha' : 'Paciente';
  const priorityColor = data.isPriority ? 'text-red-600' : 'text-[#0078bc]';
  
  const destinationName = data.destination.replace(/[0-9]/g, '').trim() || 'Sala';
  const destinationNumber = data.destination.replace(/[^0-9]/g, '') || data.destination.substring(0, 4);

  // === ALGORITMO DE AUTO-FIT (Ajuste Automático) ===
  useLayoutEffect(() => {
    if (!isMain) return; // Só aplica no layout principal
    
    const adjustFontSize = () => {
      const element = textRef.current;
      if (!element) return;

      // 1. Inicia invisível para evitar "pulo" visual
      setIsFontReady(false);

      // 2. Define tamanho máximo inicial (ex: 9rem / ~144px)
      // Se for Ticket (senha), começa ainda maior
      let currentSize = isTicket ? 180 : 130; 
      
      // Reseta estilos para medição
      element.style.fontSize = `${currentSize}px`;
      element.style.lineHeight = '1.1';
      
      // 3. Define os limites máximos da caixa de texto
      // REDUZIDO: Altura máxima mais restrita para não esconder o rodapé
      const maxHeight = 220; 
      // Largura máxima: largura do container pai (menos paddings)
      const maxWidth = element.parentElement?.clientWidth || 800;

      // 4. Loop de redução: Enquanto for maior que a caixa, diminui a fonte
      while (
        (element.scrollHeight > maxHeight || element.scrollWidth > maxWidth) && 
        currentSize > 20 // Tamanho mínimo de segurança
      ) {
        currentSize -= 2; // Passo da redução (quanto maior, mais rápido, mas menos preciso)
        element.style.fontSize = `${currentSize}px`;
      }

      // 5. Finaliza e mostra o texto
      setIsFontReady(true);
    };

    // Executa o ajuste
    adjustFontSize();
    
    // Adiciona listener para ajustar se a janela mudar de tamanho
    window.addEventListener('resize', adjustFontSize);
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [mainDisplay, isMain, isTicket]);

  // === LAYOUT PRINCIPAL (Gigante) ===
  if (isMain) {
    return (
      <div className={`
        w-full max-w-6xl mx-auto flex flex-col gap-4 md:gap-6 text-center
        transition-all duration-500 ease-out p-6 md:p-12 rounded-3xl
        ${highlight ? 'scale-105 shadow-2xl bg-white ring-4 ring-blue-100' : 'scale-100 shadow-soft bg-white'}
      `}>
        <div className="flex flex-col items-center w-full relative z-10">
          
          {data.isPriority && (
            <div className="bg-red-100 text-red-700 px-6 py-2 rounded-full font-bold uppercase tracking-widest text-base md:text-lg mb-4 animate-pulse border border-red-200">
              Atendimento Prioritário
            </div>
          )}

          {/* Container do Nome/Senha com Altura Fixa/Controlada */}
          {/* REDUZIDO: min-h de 300px para 220px para puxar o conteúdo para cima */}
          <div className="w-full border-b border-slate-100 pb-4 mb-6 flex flex-col items-center justify-center min-h-[220px]">
            <span className={`block text-xl md:text-2xl font-bold uppercase tracking-[0.3em] mb-2 ${priorityColor}`}>
              {labelText}
            </span>
            
            {/* Elemento do Nome com Ref para medição */}
            <h1 
              ref={textRef}
              className={`
                font-black text-slate-900 text-center break-words w-full px-2
                transition-opacity duration-200
                ${isFontReady ? 'opacity-100' : 'opacity-0'}
              `}
              style={{ fontSize: '4rem' }} // Fallback inicial
            >
              {mainDisplay}
            </h1>
          </div>

          <div className="w-full bg-[#0078bc] text-white px-6 py-8 rounded-2xl shadow-lg transform transition-transform">
            <span className="block text-lg md:text-xl font-medium text-blue-100 uppercase tracking-widest mb-2">
              Dirija-se para
            </span>
            <div className="text-5xl md:text-8xl font-black leading-none drop-shadow-md flex flex-wrap justify-center items-center gap-2">
              <span>{destinationName}</span>
              <span>{destinationNumber}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === LAYOUT HISTÓRICO (Lateral) - Mantido igual ===
  return (
    <div className={`
      bg-white p-5 flex flex-col shadow-sm relative overflow-hidden group 
      border-l-8 transition-all duration-300 hover:shadow-md hover:translate-x-1
      ${data.isPriority ? 'border-red-500' : 'border-[#0078bc]'}
    `}>
      <div className="flex justify-between items-center">
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
        
        <div className="text-right whitespace-nowrap pl-4 border-l border-slate-100 min-w-[80px]">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1 truncate max-w-[100px] ml-auto">
            {destinationName}
          </span>
          <div className={`text-2xl font-black leading-none ${data.isPriority ? 'text-red-600' : 'text-[#0078bc]'}`}>
            {destinationNumber}
          </div>
        </div>
      </div>
    </div>
  );
}