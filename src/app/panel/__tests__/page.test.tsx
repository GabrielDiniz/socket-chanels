import { render, screen } from '@testing-library/react';
import PanelPage from '../page';
import usePairing from '../../../hooks/usePairing';

// Mock do hook usePairing
jest.mock('../../../hooks/usePairing');
const mockedUsePairing = usePairing as jest.MockedFunction<typeof usePairing>;

// Mock do hook useSocket (usado dentro de ActiveView)
jest.mock('../../../hooks/useSocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isConnected: true,
    currentCall: null,
  })),
}));

describe('PanelPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Deve renderizar PairingView com código gerado e countdown quando não pareado', () => {
    mockedUsePairing.mockReturnValue({
      isPaired: false,
      channelSlug: null,
      token: null,
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
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByText(/Expira em: 5:00/i)).toBeInTheDocument();
  });

  it('Deve exibir "Gerando..." no PairingView quando o código de pareamento ainda não foi gerado', () => {
    mockedUsePairing.mockReturnValue({
      isPaired: false,
      channelSlug: null,
      token: null,
      generatedCode: '',
      timeLeft: 300,
      formatTime: jest.fn(() => '5:00'),
      generateNewCode: jest.fn(),
      stubPairSuccess: jest.fn(),
      clearPairing: jest.fn(),
    });

    render(<PanelPage />);

    expect(screen.getByTestId('generated-code')).toHaveTextContent('Gerando...');
  });

  it('Deve renderizar ActiveView quando pareado', () => {
    const mockSlug = 'recepcao-principal';
    
    mockedUsePairing.mockReturnValue({
      isPaired: true,
      channelSlug: mockSlug,
      token: 'token-valido',
      generatedCode: '',
      timeLeft: 0,
      formatTime: jest.fn(),
      generateNewCode: jest.fn(),
      stubPairSuccess: jest.fn(),
      clearPairing: jest.fn(),
    });

    render(<PanelPage />);

    // 1. Verifica Título da Sidebar
    expect(screen.getByText(/Últimas Chamadas/i)).toBeInTheDocument();

    /** * 2. Verifica Título do Canal (PanelHeader.tsx)
     * Usamos uma abordagem baseada em Regex no header inteiro para evitar problemas com
     * espaços em branco entre elementos (como o espaço após "Painel").
     */
    const headerTitle = screen.getByRole('heading', { level: 1 });
    // Verifica se o texto normalizado contém "PAINEL" e "RECEPCAO PRINCIPAL"
    expect(headerTitle.textContent).toMatch(/Painel\s+recepcao\s+principal/i);

    // 3. Verifica Estado Vazio da ActiveView
    expect(screen.getByText(/Aguardando Chamada/i)).toBeInTheDocument();

    // 4. Verifica Rodapé (PanelFooter.tsx)
    // No footer o slug aparece literal: "Canal: recepcao-principal"
    expect(screen.getByText(/Canal:\s+recepcao-principal/i)).toBeInTheDocument();
    
    // Garante que a view de pareamento sumiu
    expect(screen.queryByText(/Parear esta TV/i)).not.toBeInTheDocument();
  });
});