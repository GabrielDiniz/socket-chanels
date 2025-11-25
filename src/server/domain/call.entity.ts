export interface CallEntity {
  id: string;
  name: string;
  destination: string;
  professional?: string;
  timestamp: Date;
  isPriority: boolean;
  rawSource: string; // Para auditoria
}

// Interface para o Payload Normalizado que trafega no WebSocket
export interface NormalizedEvent {
  type: 'call_update' | 'queue_update';
  channel: string;
  payload: CallEntity | CallEntity[];
}