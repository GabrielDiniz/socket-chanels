// src/hooks/__tests__/useTTS.test.tsx
import { renderHook, act } from '@testing-library/react';
import useTTS from '../useTTS';

describe('useTTS Hook', () => {
  // Mocks da API SpeechSynthesis
  let mockSpeak: jest.Mock;
  let mockCancel: jest.Mock;
  let mockGetVoices: jest.Mock;
  const originalSpeechSynthesis = window.speechSynthesis;
  const originalUtterance = window.SpeechSynthesisUtterance;

  beforeEach(() => {
    mockSpeak = jest.fn();
    mockCancel = jest.fn();
    mockGetVoices = jest.fn().mockReturnValue([]);

    // Mock global do window.speechSynthesis
    // Adicionado configurable: true para permitir que testes específicos (SSR) deletem a propriedade
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: mockGetVoices,
      },
      writable: true,
      configurable: true, 
    });

    // Mock global do SpeechSynthesisUtterance
    // CORREÇÃO: Usamos function(this: any) para que o 'new' retorne o 'this' corretamente
    // e o jest capture a instância modificada em mock.instances
    (window as any).SpeechSynthesisUtterance = jest.fn().mockImplementation(function(this: any, text: string) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
    });
  });

  afterEach(() => {
    // Restaura originais
    if (originalSpeechSynthesis) {
      window.speechSynthesis = originalSpeechSynthesis;
    }
    if (originalUtterance) {
      window.SpeechSynthesisUtterance = originalUtterance;
    } else {
      delete (window as any).SpeechSynthesisUtterance;
    }
    jest.clearAllMocks();
  });

  it('Não deve quebrar se window ou speechSynthesis não existirem (SSR check)', () => {
    // CORREÇÃO: Deletamos a propriedade para que 'in window' retorne false
    // Apenas definir como undefined mantinha a chave, falhando no check !('speechSynthesis' in window)
    delete (window as any).speechSynthesis;

    const { result } = renderHook(() => useTTS());

    act(() => {
      // Não deve lançar erro
      result.current.speak('Teste');
    });

    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('Deve cancelar fala anterior antes de começar uma nova', () => {
    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.speak('Olá');
    });

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('Deve configurar Utterance com padrões pt-BR', () => {
    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.speak('Teste de configuração');
    });

    // Acessa a instância criada pelo mock (agora correta devido ao fix no beforeEach)
    const utteranceInstance = (window.SpeechSynthesisUtterance as jest.Mock).mock.instances[0];
    
    expect(utteranceInstance.lang).toBe('pt-BR');
    expect(utteranceInstance.rate).toBe(1.1);
    expect(utteranceInstance.pitch).toBe(1);
    expect(utteranceInstance.text).toBe('Teste de configuração');
  });

  it('Deve selecionar voz pt-BR preferencial (Não-Google) se disponível', () => {
    const voices = [
      { name: 'Google Português', lang: 'pt-BR' },
      { name: 'Microsoft Maria', lang: 'pt-BR' }, // Preferida
      { name: 'English US', lang: 'en-US' },
    ];
    mockGetVoices.mockReturnValue(voices);

    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.speak('Voz');
    });

    const utteranceInstance = (window.SpeechSynthesisUtterance as jest.Mock).mock.instances[0];
    // Deve escolher a Microsoft Maria pois filtra !Google
    expect(utteranceInstance.voice).toEqual(voices[1]);
  });

  it('Deve fazer fallback para qualquer pt-BR se a preferida não existir', () => {
    const voices = [
      { name: 'Google Português', lang: 'pt-BR' }, // Única pt-BR
      { name: 'English US', lang: 'en-US' },
    ];
    mockGetVoices.mockReturnValue(voices);

    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.speak('Voz Fallback');
    });

    const utteranceInstance = (window.SpeechSynthesisUtterance as jest.Mock).mock.instances[0];
    // Deve escolher Google Português pois é a única pt-BR
    expect(utteranceInstance.voice).toEqual(voices[0]);
  });

  it('Não deve atribuir voz se nenhuma pt-BR estiver disponível', () => {
    const voices = [
      { name: 'English US', lang: 'en-US' },
    ];
    mockGetVoices.mockReturnValue(voices);

    const { result } = renderHook(() => useTTS());

    act(() => {
      result.current.speak('Sem Voz');
    });

    const utteranceInstance = (window.SpeechSynthesisUtterance as jest.Mock).mock.instances[0];
    expect(utteranceInstance.voice).toBeNull();
  });
});