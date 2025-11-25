import { CallEntity } from '../domain/call.entity';
import { VersaInput, SgaInput, versaSchema, sgaSchema } from '../schemas/input.schemas';

// Interface comum para estratégias de parsing
interface PayloadStrategy {
  parse(data: unknown): CallEntity;
}

class VersaStrategy implements PayloadStrategy {
  parse(data: unknown): CallEntity {
    const parsed = versaSchema.parse(data); // Validação Zod
    return {
      id: Date.now().toString(), // Idealmente usar UUID
      name: parsed.current_call.patient_name,
      destination: parsed.current_call.destination,
      professional: parsed.current_call.professional_name,
      timestamp: new Date(),
      isPriority: false, // Regra de negócio específica do Versa
      rawSource: 'Versa',
    };
  }
}

class SgaStrategy implements PayloadStrategy {
  parse(data: unknown): CallEntity {
    // O parse aqui irá limpar os campos extras (id, unidade, servico, etc)
    // e manter apenas o que definimos no sgaSchema
    const parsed = sgaSchema.parse(data);
    
    // Tenta usar a data real da chamada do SGA, senão usa data atual
    const callDate = parsed.dataChamada ? new Date(parsed.dataChamada) : new Date();

    return {
      id: Date.now().toString(),
      name: parsed.senha.format,
      destination: `${parsed.local.nome} ${parsed.numeroLocal}`,
      professional: parsed.usuario?.login,
      timestamp: callDate,
      isPriority: parsed.prioridade.peso > 0,
      rawSource: 'NovoSGA',
    };
  }
}

// Factory para decidir qual estratégia usar
export class PayloadFactory {
  static create(payload: any): CallEntity {
    // Detecção da estratégia (pode ser melhorada com um campo 'type' explícito no header)
    if (payload.source_system?.includes('Versa')) {
      return new VersaStrategy().parse(payload);
    }
    // Verifica campos chaves do SGA
    if (payload.senha && payload.local) {
      return new SgaStrategy().parse(payload);
    }
    throw new Error('Formato de payload desconhecido ou não suportado.');
  }
}