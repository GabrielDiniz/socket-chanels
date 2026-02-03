// src/types/CallData.ts — Definição centralizada da interface de dados da chamada

export interface CallData {
  id: string | number;
  name: string;           // Usado como fallback se não houver ticket
  ticket?: string;        // Opcional, para senhas (ex: A001)
  destination: string;
  professional?: string;
  isPriority?: boolean;
  rawSource?: string;     // Ex: 'NovoSGA'
  patientName?: string;   // Compatibilidade com versões anteriores
}