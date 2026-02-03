// src/utils/__tests__/callPresenter.test.ts
import { formatCallToSpeech } from '../callPresenter';
import { CallData } from '../../types/CallData';

const mockBaseCall: CallData = {
  id: '1',
  ticket: null,
  name: null,
  patientName: null,
  destination: 'Consultório 1',
  isPriority: false,
  timestamp: Date.now(),
  rawSource: 'test',
};

describe('formatCallToSpeech (Business Logic)', () => {
  
  it('Deve formatar chamada de Paciente Comum (Nome longo, sem números)', () => {
    const data: CallData = {
      ...mockBaseCall,
      name: 'Maria da Silva',
      destination: 'Triagem',
    };

    const result = formatCallToSpeech(data);
    
    // Esperado: ". Paciente, Maria da Silva. Triagem" (Priority vazio gera ponto antes? Vamos verificar a implementação exata)
    // A implementação é: `${priorityText}. ${prefix}, ${mainText}. ${data.destination}`
    // Se priorityText for vazio, fica ". Paciente..."
    expect(result).toBe('. Paciente, Maria da Silva. Triagem');
  });

  it('Deve adicionar prefixo de Prioridade quando isPriority for true', () => {
    const data: CallData = {
      ...mockBaseCall,
      name: 'João Santos',
      isPriority: true,
      destination: 'Sala 2',
    };

    const result = formatCallToSpeech(data);
    expect(result).toBe('Atendimento Prioritário. Paciente, João Santos. Sala 2');
  });

  it('Deve identificar como SENHA se o campo ticket estiver preenchido', () => {
    const data: CallData = {
      ...mockBaseCall,
      ticket: 'A005',
      destination: 'Guichê 3',
    };

    const result = formatCallToSpeech(data);
    expect(result).toContain('Senha, A005');
  });

  it('Deve identificar como SENHA implicitamente se o texto for curto (<=6) e tiver números', () => {
    // Caso comum em sistemas legados onde o ticket vem no campo nome
    const data: CallData = {
      ...mockBaseCall,
      name: 'B-10', // Curto e com número
      destination: 'Recepção',
    };

    const result = formatCallToSpeech(data);
    expect(result).toContain('Senha, B-10');
  });

  it('Deve manter como PACIENTE se o nome for curto mas NÃO tiver números', () => {
    const data: CallData = {
      ...mockBaseCall,
      name: 'Ana', // Curto, sem números
      destination: 'Sala 1',
    };

    const result = formatCallToSpeech(data);
    expect(result).toContain('Paciente, Ana');
  });

  it('Deve priorizar ticket sobre nome/patientName na escolha do texto principal', () => {
    const data: CallData = {
      ...mockBaseCall,
      ticket: 'T-99',
      name: 'Nome Ignorado', // Se tem ticket, usa ticket
      destination: 'Sala X',
    };

    const result = formatCallToSpeech(data);
    expect(result).toContain('Senha, T-99');
    expect(result).not.toContain('Nome Ignorado');
  });

  it('Deve usar patientName se name e ticket forem nulos', () => {
    const data: CallData = {
      ...mockBaseCall,
      patientName: 'Carlos Oliveira',
      destination: 'Raio-X',
    };

    const result = formatCallToSpeech(data);
    expect(result).toContain('Paciente, Carlos Oliveira');
  });
});