// src/hooks/__tests__/useAudioAlert.test.tsx
import { renderHook, act } from '@testing-library/react';
import useAudioAlert from '../useAudioAlert';

describe('useAudioAlert', () => {
  // Mocks para window.Audio
  let originalAudio: any;
  let mockPlay: jest.Mock;
  let audioInstances: any[]; // Para rastrear as instâncias criadas

  beforeAll(() => {
    originalAudio = window.Audio;
  });

  afterAll(() => {
    window.Audio = originalAudio;
  });

  beforeEach(() => {
    audioInstances = [];
    mockPlay = jest.fn().mockResolvedValue(undefined);

    // Mock da classe Audio global
    window.Audio = jest.fn().mockImplementation((src: string) => {
      const instance = {
        play: mockPlay,
        src,
      };
      audioInstances.push(instance);
      return instance;
    }) as any;

    jest.spyOn(console, 'warn').mockImplementation(() => {}); // Silencia console.warn
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Deve instanciar Audio com o src padrão (/alert.mp3) se nenhum for fornecido', () => {
    const { result } = renderHook(() => useAudioAlert());

    act(() => {
      result.current.play();
    });

    expect(window.Audio).toHaveBeenCalledWith('/alert.mp3');
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('Deve instanciar Audio com o src personalizado fornecido', () => {
    const customSrc = '/custom-sound.wav';
    const { result } = renderHook(() => useAudioAlert(customSrc));

    act(() => {
      result.current.play();
    });

    expect(window.Audio).toHaveBeenCalledWith(customSrc);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('Deve tratar erros de autoplay (Promise rejection) sem quebrar a app', async () => {
    // Simula erro de bloqueio do navegador
    const mockError = new Error('NotAllowedError: play() failed');
    mockPlay.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAudioAlert());

    // Usamos await act para garantir que a promise rejeitada seja processada
    await act(async () => {
      result.current.play();
    });

    // Verifica se o console.warn foi chamado (indicando que o catch funcionou)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Autoplay bloqueado'),
      mockError
    );
  });
});