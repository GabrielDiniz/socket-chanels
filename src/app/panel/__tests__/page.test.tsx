// src/app/panel/__tests__/page.test.tsx — Testes de componente TDD para PanelPage (nova lógica invertida: TV show code gerado + countdown)

import { render, screen } from '@testing-library/react';
import PanelPage from '../page';
import usePairing from '../../../hooks/usePairing';

// Mock completo do hook usePairing (controlável por teste, nova API invertida)
jest.mock('../../../hooks/usePairing');

const mockedUsePairing = usePairing as jest.MockedFunction<typeof usePairing>;

describe('PanelPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Deve renderizar PairingView com código gerado e countdown quando não pareado', () => {
    mockedUsePairing.mockReturnValue({
      isPaired: false,
      channelSlug: null,
      generatedCode: '123456',
      timeLeft: 300,
      formatTime: jest.fn((seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
      }),
      generateNewCode: jest.fn(),
      stubPairSuccess: jest.fn(),
      clearPairing: jest.fn(),
    });

    render(<PanelPage />);

    expect(screen.getByText(/Parear esta TV/i)).toBeInTheDocument();
    expect(screen.getByText(/Digite este código no Painel Admin/i)).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument(); // Code big
    expect(screen.getByText(/Expira em: 5:00/i)).toBeInTheDocument(); // Countdown format
    expect(screen.getByText(/Atualize a página para novo código/i)).toBeInTheDocument();
    expect(screen.queryByText(/Canal Pareado/i)).not.toBeInTheDocument();
  });

  /**
   * Cobertura PairingView.tsx Linha 21:
   * Valida o fallback quando generatedCode é falsy (string vazia)
   */
  it('Deve exibir "Gerando..." no PairingView quando o código de pareamento ainda não foi gerado', () => {
    mockedUsePairing.mockReturnValue({
      isPaired: false,
      channelSlug: null,
      generatedCode: '', // Gatilha o operador lógico || na linha 21
      timeLeft: 300,
      formatTime: jest.fn(() => '5:00'),
      generateNewCode: jest.fn(),
      stubPairSuccess: jest.fn(),
      clearPairing: jest.fn(),
    });

    render(<PanelPage />);

    // Verifica se o fallback definido na linha 21 de PairingView.tsx é exibido
    expect(screen.getByTestId('generated-code')).toHaveTextContent('Gerando...');
  });

  it('Deve renderizar ActiveView quando pareado', () => {
    mockedUsePairing.mockReturnValue({
      isPaired: true,
      channelSlug: 'recepcao-principal',
      generatedCode: '',
      timeLeft: 0,
      formatTime: jest.fn(),
      generateNewCode: jest.fn(),
      stubPairSuccess: jest.fn(),
      clearPairing: jest.fn(),
    });

    render(<PanelPage />);

    expect(screen.getByText(/Canal Pareado: recepcao-principal/i)).toBeInTheDocument();
    expect(screen.getByText(/Conectado e pronto!/i)).toBeInTheDocument();
    expect(screen.getByText(/Aguardando próxima chamada/i)).toBeInTheDocument();
    expect(screen.queryByText(/Parear esta TV/i)).not.toBeInTheDocument();
  });
});