import { envSchema } from '../env';
import { z } from 'zod';

// Type guard
const isSuccess = (
  result: z.SafeParseReturnType<any, any>
): result is z.SafeParseSuccess<any> => result.success;

describe('Env Config', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockExit: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules(); // Limpa cache

    // Mock process.exit para lançar Error (simula falha para toThrow())
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exited with code ${code}`);
    });
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('Deve parsear envs válidas corretamente com defaults', async () => {
    process.env = {
      PORT: '4000',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://example.com',
      NEXT_ENABLED: 'false',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
    };

    // Import deve suceder sem throw
    await expect(import('../env')).resolves.toBeDefined();

    const result = envSchema.safeParse(process.env);
    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data).toMatchObject({
        PORT: 4000,
        NODE_ENV: 'production',
        NEXT_ENABLED: false,
      });
    }
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('Deve lançar erro e sair do processo em envs inválidas', async () => {
    process.env = {
      PORT: 'invalid',
      DATABASE_URL: 'invalid-url',
      CHANNEL_REGISTRATION_KEY: 'short',
    };

    // Import deve falhar com throw (simulando exit)
    await expect(import('../env')).rejects.toThrow('Exited with code 1');

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('Deve aplicar transformações corretas para NEXT_ENABLED', async () => {
    process.env = {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'true',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'supersecretkey12345',
    };

    await expect(import('../env')).resolves.toBeDefined();

    const result = envSchema.safeParse(process.env);
    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.NEXT_ENABLED).toBe(true);
    }
  });

  it('Deve permitir API_SECRET como opcional (mesmo com valor no .env)', async () => {
    process.env = {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'false',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
    };

    await expect(import('../env')).resolves.toBeDefined();

    const result = envSchema.safeParse(process.env);
    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(typeof result.data.API_SECRET).toBe('string'); // Valor do .env
    }
  });

  it('Deve validar CHANNEL_REGISTRATION_KEY com mínimo de 10 chars', async () => {
    process.env = {
      PORT: '3000',
      NODE_ENV: 'development',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'false',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
      CHANNEL_REGISTRATION_KEY: 'short',
    };

    await expect(import('../env')).rejects.toThrow('Exited with code 1');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});