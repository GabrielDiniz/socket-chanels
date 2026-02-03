// src/app/panel/_components/__tests__/CallCard.test.tsx
import React from 'react'; // Import necessário para spy no useRef
import { render, screen, act } from '@testing-library/react';
import CallCard from '../CallCard';
import { CallData } from '../../../types/CallData';

const mockCallData: CallData = {
  id: '123',
  ticket: null,
  name: 'João da Silva',
  destination: 'Consultório 05',
  isPriority: false,
  timestamp: Date.now(),
  rawSource: 'Custom',
};

const mockPriorityData: CallData = {
  ...mockCallData,
  id: '456',
  isPriority: true,
};

const mockTicketData: CallData = {
  ...mockCallData,
  id: '789',
  ticket: 'A001',
  name: null,
  rawSource: 'NovoSGA',
};

describe('CallCard Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // === 1. Testes do Layout Principal (isMain=true) ===

  it('Deve renderizar layout principal com Nome do Paciente (sem ticket)', () => {
    render(<CallCard data={mockCallData} isMain={true} />);

    // Verifica label e nome
    expect(screen.getByText('Paciente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('João da Silva');

    // Verifica formatação do destino (Separação Texto/Número)
    expect(screen.getByText('Consultório')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
  });

  it('Deve renderizar layout principal como Senha quando houver ticket ou fonte NovoSGA', () => {
    render(<CallCard data={mockTicketData} isMain={true} />);

    expect(screen.getByText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A001');
  });

  it('Deve aplicar estilos de Prioridade no layout principal', () => {
    render(<CallCard data={mockPriorityData} isMain={true} />);

    // Badge de prioridade
    expect(screen.getByText('Atendimento Prioritário')).toBeInTheDocument();
    
    // Cor vermelha no label
    const label = screen.getByText('Paciente');
    expect(label).toHaveClass('text-red-600');
  });

  it('Deve gerenciar efeito de highlight (scale/shadow) temporário ao montar', () => {
    const { container } = render(<CallCard data={mockCallData} isMain={true} />);
    
    // O container principal deve ter classes de destaque inicial
    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement.className).toContain('scale-105');
    
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Deve voltar ao estado normal
    expect(cardElement.className).toContain('scale-100');
  });

  // === 2. Testes do Layout Lateral (isMain=false) ===

  it('Deve renderizar layout lateral (histórico) de forma compacta', () => {
    render(<CallCard data={mockCallData} isMain={false} />);

    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    
    // Verifica borda azul padrão
    const card = screen.getByText('João da Silva').closest('div')?.parentElement?.parentElement;
    expect(card).toHaveClass('border-[#0078bc]');
  });

  it('Deve aplicar borda vermelha e flag "Prioridade" no layout lateral', () => {
    render(<CallCard data={mockPriorityData} isMain={false} />);
    expect(screen.getByText('Prioridade')).toBeInTheDocument();
  });

  // === 3. Testes de Lógica de Negócio (Destino e Tipos) ===

  it('Deve separar corretamente letras e números do destino', () => {
    const dataComplexDestination = { ...mockCallData, destination: 'Sala de Triagem 03' };
    render(<CallCard data={dataComplexDestination} isMain={true} />);
    expect(screen.getByText('Sala de Triagem')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  it('Deve fallback para "Sala" se destino não tiver texto', () => {
    const dataNumberOnly = { ...mockCallData, destination: '10' };
    render(<CallCard data={dataNumberOnly} isMain={true} />);
    expect(screen.getByText('Sala')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('Deve identificar como SENHA se o nome for curto (<=5) e contiver números', () => {
    const implicitTicketData = { ...mockCallData, ticket: null, name: 'A-101' };
    render(<CallCard data={implicitTicketData} isMain={true} />);
    expect(screen.getByText('Senha')).toBeInTheDocument();
  });

  // === 4. COBERTURA ESPECÍFICA (Linhas 33, 41, 58) ===

  // Cobertura Linha 33: fallback para substring se replace vazio
  it('Deve usar substring(0,4) como fallback para o número se o destino não tiver dígitos', () => {
    const noDigitData = { ...mockCallData, destination: 'Recepção Principal' };
    
    render(<CallCard data={noDigitData} isMain={true} />);
    
    // O regex /[^0-9]/g retornará vazio. O código deve fazer fallback para substring(0,4)
    // "Recepção Principal".substring(0,4) = "Rece"
    expect(screen.getByText('Rece')).toBeInTheDocument();
  });

  // Cobertura Linha 58: maxWidth fallback (|| 800) e Optional Chaining (?.)
  it('Deve usar fallback de 800px para maxWidth se o pai não tiver largura definida (clientWidth=0)', () => {
    // Cenário: clientWidth é 0. Texto tem 600px.
    // Se a lógica falhar (usar 0), 600 > 0 -> reduz fonte para 20px.
    // Se a lógica funcionar (usar 800), 600 < 800 -> mantém fonte 130px.
    const clientWidthSpy = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(0);
    const scrollWidthSpy = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    const scrollHeightSpy = jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);

    render(<CallCard data={mockCallData} isMain={true} />);
    
    const textElement = screen.getByRole('heading', { level: 1 });
    expect(textElement).toHaveStyle({ fontSize: '130px' });

    clientWidthSpy.mockRestore();
    scrollWidthSpy.mockRestore();
    scrollHeightSpy.mockRestore();
  });

  it('Deve usar fallback de 800px se element.parentElement for nulo (Cobertura Optional Chaining)', () => {
    // Cenário: element.parentElement é null.
    // Lógica esperada: null?.clientWidth é undefined. undefined || 800 é 800.
    // Teste: Texto de 600px deve caber (manter 130px). Se falhasse (ex: erro ou 0), fonte reduziria.
    
    // Sobrescreve a propriedade parentElement do protótipo para retornar null
    const parentElementSpy = jest.spyOn(HTMLElement.prototype, 'parentElement', 'get').mockReturnValue(null);
    const scrollWidthSpy = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    const scrollHeightSpy = jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);

    render(<CallCard data={mockCallData} isMain={true} />);
    
    const textElement = screen.getByRole('heading', { level: 1 });
    expect(textElement).toHaveStyle({ fontSize: '130px' });

    parentElementSpy.mockRestore();
    scrollWidthSpy.mockRestore();
    scrollHeightSpy.mockRestore();
  });

  // Cobertura Linha 41: if (!element) return;
  it('Deve abortar o ajuste de fonte se o ref for nulo (Guard Clause)', () => {
    // Mockamos useRef para retornar um objeto onde current é sempre null (read-only),
    // ignorando a tentativa do React de atribuir o elemento DOM.
    const useRefSpy = jest.spyOn(React, 'useRef').mockReturnValue({
      get current() { return null; },
      set current(_v) { /* ignora */ }
    });

    // Se o guard clause falhar, o código tentaria acessar propriedades de null e lançaria erro.
    expect(() => render(<CallCard data={mockCallData} isMain={true} />)).not.toThrow();

    useRefSpy.mockRestore();
  });

  // === 5. COBERTURA AVANÇADA (Auto-fit While Loop) ===

  it('Deve reduzir a fonte se a ALTURA exceder o limite (Cobertura while loop)', () => {
    const scrollHeightSpy = jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500); // > 220
    const scrollWidthSpy = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);   // < 800

    render(<CallCard data={mockCallData} isMain={true} />);
    
    const textElement = screen.getByRole('heading', { level: 1 });
    expect(textElement).toHaveStyle({ fontSize: '20px' });

    scrollHeightSpy.mockRestore();
    scrollWidthSpy.mockRestore();
  });

  it('Deve respeitar a largura do elemento PAI se disponível (Logic check)', () => {
    // Pai 500px, Texto 600px. Deve reduzir pois 600 > 500.
    const clientWidthSpy = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    const scrollWidthSpy = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    const scrollHeightSpy = jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100);

    render(<CallCard data={mockCallData} isMain={true} />);

    const textElement = screen.getByRole('heading', { level: 1 });
    expect(textElement).toHaveStyle({ fontSize: '20px' });

    clientWidthSpy.mockRestore();
    scrollWidthSpy.mockRestore();
    scrollHeightSpy.mockRestore();
  });

  it('Não deve tentar acessar refs ou ajustar fonte se !isMain (Cobertura early return)', () => {
    const scrollHeightSpy = jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get');

    const { rerender } = render(<CallCard data={mockCallData} isMain={false} />);
    
    expect(scrollHeightSpy).not.toHaveBeenCalled();

    rerender(<CallCard data={mockCallData} isMain={true} />);
    expect(scrollHeightSpy).toHaveBeenCalled();

    scrollHeightSpy.mockRestore();
  });

  it('Deve aplicar classes de tipografia corretas no Sidebar (Whitebox Check)', () => {
    const { unmount } = render(<CallCard data={mockTicketData} isMain={false} />);
    const ticketName = screen.getByText('A001');
    expect(ticketName).toHaveClass('text-3xl'); 
    unmount();

    render(<CallCard data={mockCallData} isMain={false} />);
    const patientName = screen.getByText('João da Silva');
    expect(patientName).toHaveClass('text-xl'); 
  });
});