// src/app/panel/_components/__tests__/ActiveView.test.tsx
import { render, screen } from '@testing-library/react';
import ActiveView from '../ActiveView';
import usePanelLogic from '../../../../hooks/usePanelLogic';

// Mock do hook usePanelLogic para controlarmos o retorno
jest.mock('../../../../hooks/usePanelLogic');
const mockedUsePanelLogic = usePanelLogic as jest.MockedFunction<typeof usePanelLogic>;

// Mock dos componentes filhos para focar puramente na lógica da View
jest.mock('../CallCard', () => ({ data }: { data: any }) => (
  <div data-testid="call-card">{data.patientName || data.name}</div>
));

jest.mock('../layout/PanelSidebar', () => ({ history }: { history: any[] }) => (
  <div data-testid="panel-sidebar">
    {history.map((call) => (
      <div key={call.id} data-testid="history-item">
        {call.patientName || call.name}
      </div>
    ))}
  </div>
));

// Mocks simples de layout
jest.mock('../layout/PanelHeader', () => () => <div data-testid="panel-header">Header</div>);
jest.mock('../layout/PanelFooter', () => () => <div data-testid="panel-footer">Footer</div>);

describe('ActiveView Logic & Coverage', () => {
  const defaultProps = {
    channelSlug: 'test-channel',
    token: 'test-token',
    clearPairing: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Deve renderizar estado de "Aguardando Chamada" quando currentCall é null (Cobertura linhas 68-70)', () => {
    mockedUsePanelLogic.mockReturnValue({
      isConnected: true,
      currentCall: null,
    });

    render(<ActiveView {...defaultProps} />);

    // Verifica se renderiza o texto de fallback
    expect(screen.getByText(/Aguardando Chamada/i)).toBeInTheDocument();
    // Garante que o Card não está renderizado
    expect(screen.queryByTestId('call-card')).not.toBeInTheDocument();
  });

  it('Deve gerenciar histórico e deduplicar chamadas (Cobertura linhas 28-47)', () => {
    // Inicializa sem chamada
    mockedUsePanelLogic.mockReturnValue({ isConnected: true, currentCall: null });
    const { rerender } = render(<ActiveView {...defaultProps} />);

    const simulateNewCall = (newCall: any) => {
      mockedUsePanelLogic.mockReturnValue({ isConnected: true, currentCall: newCall });
      rerender(<ActiveView {...defaultProps} />);
    };

    // 1. Chegada da Chamada A (Ticket 001)
    const callA = { id: '1', ticket: '001', name: 'João', patientName: 'João' };
    simulateNewCall(callA);

    expect(screen.getByTestId('call-card')).toHaveTextContent('João');
    // Sidebar vazia pois a única chamada é a atual
    expect(screen.queryByTestId('history-item')).not.toBeInTheDocument();

    // 2. Chegada da Chamada B (Ticket 002)
    const callB = { id: '2', ticket: '002', name: 'Maria', patientName: 'Maria' };
    simulateNewCall(callB);

    expect(screen.getByTestId('call-card')).toHaveTextContent('Maria');
    // João vai para o histórico
    expect(screen.getByTestId('panel-sidebar')).toHaveTextContent('João');

    // 3. Recall da Chamada A (Mesmo ID '1') - Cobertura Linha 35
    // Simula chamar o João de novo. Ele deve sair do histórico e ir para o Main.
    simulateNewCall(callA);
    expect(screen.getByTestId('call-card')).toHaveTextContent('João');
    
    // Maria deve estar no histórico. João NÃO deve estar duplicado no histórico.
    const historyItemsAfterRecall = screen.getAllByTestId('history-item');
    expect(historyItemsAfterRecall).toHaveLength(1);
    expect(historyItemsAfterRecall[0]).toHaveTextContent('Maria');

    // 4. Nova chamada com Mesmo Ticket (ID dif, Ticket igual) - Cobertura Linha 38
    // Maria gerou novo evento ID 3, mas mesmo ticket '002'
    const callB_Recall = { id: '3', ticket: '002', name: 'Maria Reloaded', patientName: 'Maria Reloaded' };
    simulateNewCall(callB_Recall);

    expect(screen.getByTestId('call-card')).toHaveTextContent('Maria Reloaded');
    // Sidebar deve ter João. A Maria antiga (ID 2) deve sumir por colisão de ticket.
    const historyItemsTicketDedup = screen.getAllByTestId('history-item');
    expect(historyItemsTicketDedup).toHaveLength(1);
    expect(historyItemsTicketDedup[0]).toHaveTextContent('João');

    // 5. Nova chamada Nominal (Sem Ticket, Mesmo Nome) - Cobertura Linha 41
    const callNominal = { id: '4', ticket: null, name: 'Pedro', patientName: 'Pedro' };
    simulateNewCall(callNominal);

    // Agora temos: Main(Pedro), Sidebar(Maria Reloaded, João)
    expect(screen.getAllByTestId('history-item')).toHaveLength(2);

    // Recall do Pedro (ID diferente, mas mesmo nome e sem ticket)
    const callNominal_Recall = { id: '5', ticket: null, name: 'Pedro', patientName: 'Pedro' };
    simulateNewCall(callNominal_Recall);

    // Main(Pedro ID5). Sidebar(Maria Reloaded, João).
    // O Pedro ID4 deve ser removido para não duplicar.
    const historyItemsNameDedup = screen.getAllByTestId('history-item');
    expect(historyItemsNameDedup).toHaveLength(2);
    expect(screen.queryByText('Pedro', { selector: '[data-testid="history-item"]' })).not.toBeInTheDocument();
  });

  it('Deve limitar o histórico a 5 itens visíveis na sidebar (Cobertura Linha 45)', () => {
    mockedUsePanelLogic.mockReturnValue({ isConnected: true, currentCall: null });
    const { rerender } = render(<ActiveView {...defaultProps} />);

    // Adiciona 10 chamadas em sequência
    for (let i = 1; i <= 10; i++) {
      const call = { id: `${i}`, ticket: `T${i}`, name: `P${i}`, patientName: `P${i}` };
      mockedUsePanelLogic.mockReturnValue({ isConnected: true, currentCall: call });
      rerender(<ActiveView {...defaultProps} />);
    }

    // Chamada Atual: P10
    expect(screen.getByTestId('call-card')).toHaveTextContent('P10');

    // Sidebar deve conter P9, P8, P7, P6, P5 (Total 5)
    const items = screen.getAllByTestId('history-item');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('P9'); // Mais recente
    expect(items[4]).toHaveTextContent('P5'); // Mais antigo
  });

  it('Deve mostrar histórico completo na sidebar se currentCall tornar-se null (Cobertura linha 51 e Optional Chaining)', () => {
    // 1. Inicia com Chamada Ativa (João)
    // Isso popula o state 'history' com [João]
    const callA = { id: '1', ticket: '001', name: 'João', patientName: 'João' };
    mockedUsePanelLogic.mockReturnValue({ isConnected: true, currentCall: callA });
    
    const { rerender } = render(<ActiveView {...defaultProps} />);

    // Estado inicial: Main=[João], Sidebar=[] (pois João == currentCall)
    expect(screen.getByTestId('call-card')).toHaveTextContent('João');
    expect(screen.queryByTestId('history-item')).not.toBeInTheDocument();

    // 2. Transição para NULL (Simula perda de sinal ou fim de fila)
    // O 'useEffect' de histórico NÃO roda para null, então 'history' mantém [João]
    mockedUsePanelLogic.mockReturnValue({ isConnected: true, currentCall: null });
    rerender(<ActiveView {...defaultProps} />);

    // Verificação da Linha 51:
    // Filtro: call.id (1) !== currentCall?.id (undefined) -> TRUE
    // Resultado: João deve aparecer na Sidebar agora
    
    expect(screen.getByText(/Aguardando Chamada/i)).toBeInTheDocument(); // Main vazio
    const historyItems = screen.getAllByTestId('history-item');
    expect(historyItems).toHaveLength(1);
    expect(historyItems[0]).toHaveTextContent('João');
  });

});