// src/app/panel/_components/layout/__tests__/PanelSidebar.test.tsx

import { render, screen } from '@testing-library/react';
import PanelSidebar from '../PanelSidebar';
import { CallData } from '../../../../../types/CallData';

// Mock do componente CallCard para isolar o teste do Sidebar e verificar props
jest.mock('../../CallCard', () => ({ data, isMain }: { data: CallData; isMain: boolean }) => (
  <div data-testid="call-card-mock" data-ismain={isMain.toString()}>
    {data.patientName || data.name}
  </div>
));

const mockHistory: CallData[] = [
  {
    id: '1',
    ticket: 'A001',
    name: 'João Silva',
    destination: 'Consultório 1',
    isPriority: false,
    timestamp: Date.now(),
    rawSource: 'test',
  },
  {
    id: '2',
    ticket: 'A002',
    name: 'Maria Santos',
    destination: 'Triagem',
    isPriority: true,
    timestamp: Date.now(),
    rawSource: 'test',
  },
];

describe('PanelSidebar Component', () => {
  it('Deve renderizar o estado vazio ("Histórico vazio") quando não houver histórico', () => {
    render(<PanelSidebar history={[]} />);

    // Verifica se o texto de empty state está presente
    expect(screen.getByText('Histórico vazio')).toBeInTheDocument();
    
    // Verifica se o ícone decorativo (ponto) está presente
    expect(screen.getByText('•')).toBeInTheDocument();

    // Garante que nenhum card foi renderizado
    expect(screen.queryByTestId('call-card-mock')).not.toBeInTheDocument();
  });

  it('Deve renderizar a lista de CallCards quando houver histórico', () => {
    render(<PanelSidebar history={mockHistory} />);

    // O empty state não deve aparecer
    expect(screen.queryByText('Histórico vazio')).not.toBeInTheDocument();

    // Verifica se renderizou o número correto de cards
    const cards = screen.getAllByTestId('call-card-mock');
    expect(cards).toHaveLength(2);

    // Verifica se os dados foram passados corretamente para os mocks
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
  });

  it('Deve passar isMain={false} para todos os CallCards', () => {
    render(<PanelSidebar history={mockHistory} />);

    const cards = screen.getAllByTestId('call-card-mock');
    
    // Verifica se a prop isMain foi recebida como false (conforme layout lateral)
    cards.forEach(card => {
      expect(card).toHaveAttribute('data-ismain', 'false');
    });
  });

  it('Deve renderizar corretamente a estrutura do layout (Cabeçalho e Rodapé)', () => {
    render(<PanelSidebar history={[]} />);

    // Cabeçalho
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Últimas Chamadas/i);
    
    // Rodapé
    expect(screen.getByText(/Histórico Recente/i)).toBeInTheDocument();
  });
});