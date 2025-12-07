import { envSchema } from '../env';
import { z } from 'zod';

// IMPEDE que o dotenv carregue o arquivo .env real durante os testes
// Isso garante que apenas as envs definidas manualmente no teste existam


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

  it('Deve construir DATABASE_URL a partir das variáveis atômicas quando não fornecida', async () => {
    jest.mock('dotenv');
    jest.mock('dotenv/config', () => {});
    process.env = {
      PORT: '3000',
      NODE_ENV: 'production',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'false',
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
      // Variáveis atômicas fornecidas, mas DATABASE_URL ausente
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_USER: 'user_fallback',
      DB_PASS: 'pass_fallback',
      DB_NAME: 'db_fallback',
    };

    // A importação deve disparar a lógica de fallback no arquivo env.ts
    const { env } = await import('../env');

    expect(env.DATABASE_URL).toBe(
      'mysql://user_fallback:pass_fallback@localhost:3306/db_fallback'
    );
    expect(mockExit).not.toHaveBeenCalled();
  });

  it('Deve falhar e sair se DATABASE_URL e variáveis atômicas estiverem ausentes', async () => {
    jest.mock('dotenv');
    jest.mock('dotenv/config', () => {});
    process.env = {
      PORT: '3000',
      NODE_ENV: 'production',
      CORS_ORIGIN: '*',
      NEXT_ENABLED: 'false',
      CHANNEL_REGISTRATION_KEY: 'validkey123456',
      // Sem DATABASE_URL e sem as variáveis atômicas completas
      DB_HOST: 'localhost',
      // Faltam DB_USER, DB_PASS, DB_NAME propositalmente para forçar erro
    };

    // Como o dotenv está mockado, ele não vai preencher as variáveis faltantes do .env real
    await expect(import('../env')).rejects.toThrow('Exited with code 1');

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Erro Fatal: DATABASE_URL não definida')
    );
  });
});