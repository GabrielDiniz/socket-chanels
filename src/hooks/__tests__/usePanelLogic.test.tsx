// src/hooks/__tests__/usePanelLogic.test.tsx
import { renderHook, act } from '@testing-library/react';
import usePanelLogic from '../usePanelLogic';
import useSocket from '../useSocket';
import useTTS from '../useTTS';
import useAudioAlert from '../useAudioAlert';
import { formatCallToSpeech } from '../../utils/callPresenter';
import { CallData } from '../../types/CallData';

// Mocks dos hooks dependentes e utilitários
jest.mock('../useSocket');
jest.mock('../useTTS');
jest.mock('../useAudioAlert');
jest.mock('../../utils/callPresenter');

describe('usePanelLogic', () => {
  const mockSpeak = jest.fn();
  const mockPlay = jest.fn();
  const mockFormat = jest.fn();
  
  // Dados de teste
  const mockCallData: CallData = {
    id: '123',
    ticket: 'A001',
    name: 'João',
    destination: 'Sala 1',
    isPriority: false,
    timestamp: Date.now(),
    rawSource: 'test'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Configuração padrão dos Mocks
    (useTTS as jest.Mock).mockReturnValue({ speak: mockSpeak });
    (useAudioAlert as jest.Mock).mockReturnValue({ play: mockPlay });
    (formatCallToSpeech as jest.Mock).mockImplementation((data) => `Texto falado para ${data.name}`);
    
    // Mock do useSocket para capturar o callback handleNewCall
    (useSocket as jest.Mock).mockImplementation((_slug, _token, onCallReceived) => {
      // Retorno padrão do hook
      return {
        isConnected: true,
        lastCall: null, // Inicialmente null
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Deve repassar isConnected e currentCall do useSocket', () => {
    (useSocket as jest.Mock).mockReturnValue({
      isConnected: true,
      lastCall: mockCallData
    });

    const { result } = renderHook(() => usePanelLogic('slug-teste', 'token-teste'));

    expect(result.current.isConnected).toBe(true);
    expect(result.current.currentCall).toEqual(mockCallData);
  });

  it('Deve orquestrar Áudio -> Formatação -> TTS (com delay) ao receber nova chamada', () => {
    // Variável para armazenar o callback registrado no useSocket
    let capturedCallback: ((data: CallData) => void) | undefined;

    // Sobrescreve mock para capturar o callback
    (useSocket as jest.Mock).mockImplementation((_slug, _token, cb) => {
      capturedCallback = cb;
      return { isConnected: true, lastCall: null };
    });

    renderHook(() => usePanelLogic('slug-teste', 'token-teste'));

    // Verifica se o callback foi capturado
    expect(capturedCallback).toBeDefined();

    // EXECUÇÃO: Simula o socket entregando uma nova chamada
    act(() => {
      capturedCallback?.(mockCallData);
    });

    // 1. Verifica Efeito Sonoro (Imediato)
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // 2. Verifica Formatação
    expect(formatCallToSpeech).toHaveBeenCalledWith(mockCallData);

    // 3. Verifica TTS (Não deve ter sido chamado ainda devido ao delay)
    expect(mockSpeak).not.toHaveBeenCalled();

    // AVANÇA O TEMPO (800ms)
    act(() => {
      jest.advanceTimersByTime(800);
    });

    // 4. Verifica TTS (Deve ter sido chamado agora)
    expect(mockSpeak).toHaveBeenCalledWith('Texto falado para João');
  });

  it('Não deve chamar TTS antes do tempo de delay (800ms)', () => {
    let capturedCallback: ((data: CallData) => void) | undefined;
    (useSocket as jest.Mock).mockImplementation((_s, _t, cb) => {
      capturedCallback = cb;
      return { isConnected: true, lastCall: null };
    });

    renderHook(() => usePanelLogic('slug', 'token'));

    act(() => {
      capturedCallback?.(mockCallData);
    });

    // Avança apenas 799ms
    act(() => {
      jest.advanceTimersByTime(799);
    });

    expect(mockSpeak).not.toHaveBeenCalled();
    
    // Avança +1ms
    act(() => {
      jest.advanceTimersByTime(1);
    });
    
    expect(mockSpeak).toHaveBeenCalled();
  });
});