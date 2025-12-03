import { envSchema } from '../env'; // Ajuste o path se necessário
import { z } from 'zod';

describe('Env Config', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = process.env;
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('Deve parsear envs válidas corretamente com defaults', () => {
    process.env = {
      PORT: '4000',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      NEXT_ENABLED: 'false',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
    };

    const parsed = envSchema.safeParse(process.env);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      PORT: 4000,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      NEXT_ENABLED: false,
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      API_SECRET: undefined, // Opcional
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
    });
  });

  it('Deve lançar erro e sair do processo em envs inválidas', () => {
    process.env = {
      PORT: 'invalid', // Não numérico
      DATABASE_URL: 'invalid-url',
      CHANNEL_REGISTRATION_KEY: 'short', // Menos de 10 chars
    };

    const parsed = envSchema.safeParse(process.env);
    expect(parsed.success).toBe(false);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('Deve aplicar transformações corretas para NEXT_ENABLED', () => {
    process.env = {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'true',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'supersecretkey12345',
    };

    const parsed = envSchema.safeParse(process.env);
    expect(parsed.success).toBe(true);
    expect(parsed.data.NEXT_ENABLED).toBe(true);
  });

  it('Deve permitir API_SECRET como opcional sem erro', () => {
    process.env = {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'false',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
      // Sem API_SECRET
    };

    const parsed = envSchema.safeParse(process.env);
    expect(parsed.success).toBe(true);
    expect(parsed.data.API_SECRET).toBeUndefined();
  });

  it('Deve validar CHANNEL_REGISTRATION_KEY com mínimo de 10 chars', () => {
    process.env = {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'false',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'shortkey', // Inválido
    };

    const parsed = envSchema.safeParse(process.env);
    expect(parsed.success).toBe(false);
  });
});