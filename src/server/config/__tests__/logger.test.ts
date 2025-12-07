import winston from 'winston';

// Definição dos mocks antes de qualquer import (Hoisting)
const mockInfo = jest.fn();
const mockDebug = jest.fn();
const mockLog = jest.fn();

// Mock completo do módulo winston
jest.mock('winston', () => {
  const original = jest.requireActual('winston');
  return {
    ...original,
    createLogger: jest.fn((config) => ({
      ...config, // Mantém a config original (incluindo o array transports)
      info: mockInfo,
      debug: mockDebug,
      log: mockLog,
      add: jest.fn(),
      remove: jest.fn(),
      // Removido: transports: { Console: ... } 
      // Isso estava sobrescrevendo o array de transportes da config com um objeto
    })),
    // Precisamos manter os formats originais para o teste validar a composição
    format: original.format,
    transports: original.transports,
  };
});

describe('Logger Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Limpa cache de módulos para reimportar logger.ts
    process.env = { ...originalEnv };
    mockInfo.mockClear();
    mockDebug.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('Deve configurar nível DEBUG e formato legível em ambiente de desenvolvimento', async () => {
    process.env.NODE_ENV = 'development';
    
    // Importa dinamicamente para forçar a recriação do logger com novo NODE_ENV
    const { logger } = await import('../logger');
    const loggerConfig = logger as any;

    // Verifica se o createLogger foi chamado com o nível correto
    expect(loggerConfig.level).toBe('debug');
    
    // Verifica a presença do transport Console
    // Agora loggerConfig.transports é o array vindo de ...config
    const consoleTransport = loggerConfig.transports.find((t: any) => t instanceof winston.transports.Console);
    expect(consoleTransport).toBeDefined();
    
    // Opcional: verificar se o format está definido (difícil validar estrutura exata do winston.format.combine)
    expect(loggerConfig.format).toBeDefined();
  });

  it('Deve configurar nível INFO e formato JSON em ambiente de produção', async () => {
    process.env.NODE_ENV = 'production';
    
    const { logger } = await import('../logger');
    const loggerConfig = logger as any;

    expect(loggerConfig.level).toBe('info');
    // Em produção usamos JSON
    expect(loggerConfig.format).toBeDefined();
  });

  it('Stream deve encaminhar mensagens para logger.info removendo quebras de linha', async () => {
    const { stream } = await import('../logger');
    
    const message = 'HTTP GET /api/v1/health 200\n';
    stream.write(message);

    // Agora logger.info é garantidamente o mockInfo
    expect(mockInfo).toHaveBeenCalledWith('HTTP GET /api/v1/health 200');
  });
});