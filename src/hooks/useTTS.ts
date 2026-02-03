// src/hooks/useTTS.ts — Hook responsável apenas pela síntese de voz (SRP)
import { useCallback } from 'react';

export default function useTTS() {
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Cancela falas anteriores para evitar sobreposição
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.1;
    utterance.pitch = 1;

    // Seleção de voz: prioriza pt-BR que não seja "Google" (tende a ser robótica em alguns OS),
    // ou aceita qualquer pt-BR disponível.
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.includes('pt-BR') && !v.name.includes('Google')) 
                 || voices.find(v => v.lang.includes('pt-BR'));
    
    if (ptVoice) utterance.voice = ptVoice;

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}