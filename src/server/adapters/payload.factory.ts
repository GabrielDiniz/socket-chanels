import { CallEntity } from '../domain/call.entity';
import { versaSchema, sgaSchema } from '../schemas/input.schemas';

interface PayloadStrategy {
  parse(data: unknown): CallEntity;
}

class VersaStrategy implements PayloadStrategy {
  parse(data: unknown): CallEntity {
    const parsed = versaSchema.parse(data);
    return {
      id: Date.now().toString(),
      name: parsed.current_call.patient_name,
      destination: parsed.current_call.destination,
      professional: parsed.current_call.professional_name,
      timestamp: new Date(),
      isPriority: false,
      rawSource: 'Versa',
      routingKey: parsed.current_call.sector_id?.toString(),
    };
  }
}

class SgaStrategy implements PayloadStrategy {
  parse(data: unknown): CallEntity {
    const parsed = sgaSchema.parse(data);
    const callDate = parsed.dataChamada ? new Date(parsed.dataChamada) : new Date();

    // Extrai ID do serviço ou local para roteamento
    const routingKey = parsed.servico?.id?.toString() || parsed.local?.id?.toString();

    return {
      id: Date.now().toString(),
      name: parsed.cliente?.nome || parsed.senha.format,
      destination: `${parsed.local.nome} ${parsed.numeroLocal}`,
      professional: parsed.usuario?.login,
      timestamp: callDate,
      isPriority: parsed.prioridade.peso > 0,
      rawSource: 'NovoSGA',
      routingKey: routingKey,
    };
  }
}

export class PayloadFactory {
  static create(payload: any): CallEntity {
    if (payload.source_system?.includes('Versa')) {
      return new VersaStrategy().parse(payload);
    }
    
    if (payload.senha && payload.local) {
      return new SgaStrategy().parse(payload);
    }

    throw new Error('Formato de payload desconhecido ou não suportado.');
  }
}