// src/hooks/useAudioAlert.ts — Hook responsável apenas pelo alerta sonoro (SRP)
import { useCallback } from 'react';

export default function useAudioAlert(src: string = '/alert.mp3') {
  const play = useCallback(() => {
    const audio = new Audio(src);
    
    audio.play().catch((err) => {
      console.warn("[useAudioAlert] Autoplay bloqueado pelo navegador. Interação necessária.", err);
    });
  }, [src]);

  return { play };
}