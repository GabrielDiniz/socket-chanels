import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Formato customizado para desenvolvimento (legível por humanos)
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), json()), // Produção: JSON estruturado
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'production' 
        ? combine(timestamp(), json()) 
        : combine(timestamp(), colorize(), devFormat),
    }),
  ],
});

// Stream para integrar com o Morgan (HTTP logger) se adicionarmos depois
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};