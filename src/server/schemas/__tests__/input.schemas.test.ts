import { versaSchema, sgaSchema, VersaInput, SgaInput } from '../input.schemas';

describe('Input Schemas', () => {
  describe('versaSchema', () => {
    it('Deve validar payload Versa válido completo', () => {
      const validPayload = {
        source_system: 'VersaTest',
        current_call: {
          patient_name: 'Paciente Teste',
          destination: 'Consultório 1',
          professional_name: 'Dr. Teste',
        },
      };
      expect(versaSchema.safeParse(validPayload).success).toBe(true);
    });

    it('Deve rejeitar payload Versa faltando campos obrigatórios', () => {
      const invalidPayload = {
        source_system: 'VersaTest',
        current_call: {
          // Sem patient_name
          destination: 'Consultório 1',
        },
      };
      const result = versaSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain('patient_name');
    });

    it('Deve ignorar campos extras sem erro', () => {
      const payloadWithExtra = {
        source_system: 'VersaTest',
        current_call: {
          patient_name: 'Paciente Teste',
          destination: 'Consultório 1',
          extra_field: 'ignored',
        },
        another_extra: 'ignored',
      };
      expect(versaSchema.safeParse(payloadWithExtra).success).toBe(true);
    });
  });

  describe('sgaSchema', () => {
    it('Deve validar payload SGA válido com prioridade >0', () => {
      const validPayload = {
        senha: { format: 'A001' },
        local: { nome: 'Sala 1' },
        numeroLocal: 1,
        prioridade: { peso: 2, nome: 'Alta' },
        usuario: { login: 'user1' },
        dataChamada: '2023-01-01T00:00:00Z',
      };
      expect(sgaSchema.safeParse(validPayload).success).toBe(true);
    });

    it('Deve rejeitar payload SGA inválido (ex: numeroLocal como string)', () => {
      const invalidPayload = {
        senha: { format: 'A001' },
        local: { nome: 'Sala 1' },
        numeroLocal: 'invalid', // Deve ser number
        prioridade: { peso: 1 },
      };
      const result = sgaSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain('numeroLocal');
    });

    it('Deve tratar dataChamada opcional/null corretamente', () => {
      const payloadWithoutDate = {
        senha: { format: 'A001' },
        local: { nome: 'Sala 1' },
        numeroLocal: 1,
        prioridade: { peso: 0 },
      };
      expect(sgaSchema.safeParse(payloadWithoutDate).success).toBe(true);

      const payloadWithNullDate = {
        ...payloadWithoutDate,
        dataChamada: null,
      };
      expect(sgaSchema.safeParse(payloadWithNullDate).success).toBe(true);
    });

    it('Deve inferir tipos corretos para SgaInput', () => {
      const validPayload: SgaInput = {
        senha: { format: 'A001' },
        local: { nome: 'Sala 1' },
        numeroLocal: 1,
        prioridade: { peso: 1 },
        usuario: { login: 'user1' },
        dataChamada: '2023-01-01',
      };
      const parsed = sgaSchema.parse(validPayload);
      expect(typeof parsed.numeroLocal).toBe('number');
      expect(typeof parsed.dataChamada).toBe('string');
    });
  });
});