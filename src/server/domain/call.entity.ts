export interface CallEntity {
  id: string;
  name: string;
  destination: string;
  professional?: string;
  timestamp: Date;
  isPriority: boolean;
  
  // Chave extraída para roteamento (ex: "5", "COL")
  routingKey?: string; 
  
  rawSource: string;
}

export interface NormalizedEvent {
  type: 'call_update' | 'queue_update';
  channel: string;
  payload: CallEntity | CallEntity[];
}