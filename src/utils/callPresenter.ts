// src/utils/callPresenter.ts — Lógica pura de transformação de dados em texto falado (SRP/OCP)
import { CallData } from '../types/CallData';

export const formatCallToSpeech = (data: CallData): string => {
  const priorityText = data.isPriority ? 'Atendimento Prioritário' : '';
  const mainText = data.ticket || data.name || data.patientName || '';
  
  // Regra de negócio isolada: Decidir se fala "Senha" ou "Paciente"
  // Se tiver campo ticket OU se o texto for curto (<=6 chars) e tiver números (ex: A052)
  const isTicket = !!data.ticket || (mainText.length <= 6 && /\d/.test(mainText));
  const prefix = isTicket ? 'Senha' : 'Paciente';

  // Retorna a frase formatada: "Atendimento Prioritário. Senha A 0 5. Guichê 2"
  return `${priorityText}. ${prefix}, ${mainText}. ${data.destination}`;
};