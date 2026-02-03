// src/hooks/usePanelLogic.ts — O Orquestrador (Composition Root). Une Socket, Áudio e TTS.
import { useCallback } from 'react';
import useSocket from './useSocket';
import useTTS from './useTTS';
import useAudioAlert from './useAudioAlert';
import { formatCallToSpeech } from '../utils/callPresenter';
import { CallData } from '../types/CallData';

export default function usePanelLogic(channelSlug: string, token: string) {
  const { speak } = useTTS();
  const { play } = useAudioAlert();

  // Callback que define O QUE fazer quando chega uma chamada (Orquestração)
  const handleNewCall = useCallback((data: CallData) => {
    // 1. Efeito Sonoro
    play();

    // 2. Formatação da mensagem (Regra de negócio pura)
    const speechText = formatCallToSpeech(data);

    // 3. Efeito de Fala (com delay para não atropelar o sino)
    setTimeout(() => speak(speechText), 800);
  }, [play, speak]);

  // Injeta o callback no socket
  const { isConnected, lastCall } = useSocket(channelSlug, token, handleNewCall);

  return {
    isConnected,
    currentCall: lastCall
  };
}