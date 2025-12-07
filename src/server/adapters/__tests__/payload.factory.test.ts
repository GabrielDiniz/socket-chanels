import { PayloadFactory } from '../payload.factory';
import { CallEntity } from '../../domain/call.entity';
import { ZodError } from 'zod';

describe('Payload Factory', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1234567890);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Deve criar VersaStrategy e parsear payload Versa válido em CallEntity correta (ex: isPriority=false)', () => {
    const validVersaPayload = {
      source_system: 'VersaTest',
      current_call: {
        patient_name: 'Paciente Teste',
        destination: 'Consultório 1',
        professional_name: 'Dr. Teste',
      },
    };
    const entity = PayloadFactory.create(validVersaPayload);
    expect(entity).toEqual({
      id: '1234567890',
      name: 'Paciente Teste',
      destination: 'Consultório 1',
      professional: 'Dr. Teste',
      timestamp: new Date(1234567890),
      isPriority: false,
      rawSource: 'Versa',
    });
  });

  it('Deve lançar erro em payload Versa inválido (via Zod)', () => {
    const invalidVersaPayload = {
      source_system: 'VersaTest',
      current_call: {
        destination: 'Consultório 1',
      },
    };
    expect(() => PayloadFactory.create(invalidVersaPayload)).toThrow(ZodError);
  });

  // Testes para NovoSGA
  it('Deve criar SgaStrategy e parsear payload SGA válido, calculando isPriority baseado em peso', () => {
    const validSgaPayload = {
      senha: { format: 'A001' },
      local: { nome: 'Sala 1' },
      numeroLocal: 1,
      prioridade: { peso: 2 },
      usuario: { login: 'user1' },
      dataChamada: '2023-01-01T00:00:00Z',
    };
    const entity = PayloadFactory.create(validSgaPayload);
    expect(entity).toEqual({
      id: '1234567890',
      name: 'A001',
      destination: 'Sala 1 1',
      professional: 'user1',
      timestamp: new Date('2023-01-01T00:00:00Z'),
      isPriority: true, // peso 2 > 0 -> true
      rawSource: 'NovoSGA',
    });
  });

  it('Deve considerar isPriority false se peso for 0 no SGA', () => {
    const sgaLowPriority = {
      senha: { format: 'N001' },
      local: { nome: 'Triagem' },
      numeroLocal: 2,
      prioridade: { peso: 0 },
      dataChamada: '2023-01-01T00:00:00Z',
    };
    const entity = PayloadFactory.create(sgaLowPriority);
    expect(entity.isPriority).toBe(false);
  });

  it('Deve usar dataChamada se presente, senão Date.now()', () => {
    const sgaWithoutDate = {
      senha: { format: 'A002' },
      local: { nome: 'Sala 2' },
      numeroLocal: 2,
      prioridade: { peso: 0 },
    };
    const entity = PayloadFactory.create(sgaWithoutDate);
    expect(entity.timestamp).toEqual(new Date(1234567890));
  });


  it('Deve lançar erro em payload desconhecido (nem Versa nem SGA)', () => {
    const unknownPayload = { invalid: 'data' };
    expect(() => PayloadFactory.create(unknownPayload)).toThrow('Formato de payload desconhecido ou não suportado.');
  });

  it('Deve gerar ID único (mockar Date.now para previsibilidade)', () => {
    const validPayload = {
      source_system: 'VersaTest',
      current_call: {
        patient_name: 'Test',
        destination: 'Dest',
      },
    };
    const entity = PayloadFactory.create(validPayload);
    expect(entity.id).toBe('1234567890');
  });

  it('Deve ignorar campos extras em ambos os strategies', () => {
    const versaWithExtra = {
      source_system: 'VersaTest',
      current_call: {
        patient_name: 'Test',
        destination: 'Dest',
        extra: 'ignored',
      },
      more_extra: 'ignored',
    };
    const versaEntity = PayloadFactory.create(versaWithExtra);
    expect(versaEntity).not.toHaveProperty('extra');

    const sgaWithExtra = {
      senha: { format: 'A003' },
      local: { nome: 'Sala 3' },
      numeroLocal: 3,
      prioridade: { peso: 1 },
      extra: 'ignored',
    };
    const sgaEntity = PayloadFactory.create(sgaWithExtra);
    expect(sgaEntity).not.toHaveProperty('extra');
  });
});