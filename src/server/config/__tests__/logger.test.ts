import winston from 'winston';

// Mocks
const mockInfo = jest.fn();
const mockDebug = jest.fn();

// Mock do winston.createLogger para inspecionar a configuração criada
jest.spyOn(winston, 'createLogger').mockImplementation((config: any) => {
  return {
    ...config, // Retorna a config para podermos inspecionar nos testes
    info: mockInfo,
    debug: mockDebug,
    log: jest.fn(),
  } as any;
});

describe('Logger Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
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
    
    // Importa dinamicamente para pegar o novo NODE_ENV
    const { logger } = await import('../logger');
    const loggerConfig = logger as any;

    expect(loggerConfig.level).toBe('debug');
    
    // Verifica se tem Console transport
    const consoleTransport = loggerConfig.transports.find((t: any) => t instanceof winston.transports.Console);
    expect(consoleTransport).toBeDefined();
    
    // Em dev, esperamos colorize (pode ser difícil testar o format exato, mas verificamos a presença)
    expect(consoleTransport.format).toBeDefined();
  });

  it('Deve configurar nível INFO e formato JSON em ambiente de produção', async () => {
    process.env.NODE_ENV = 'production';
    
    const { logger } = await import('../logger');
    const loggerConfig = logger as any;

    expect(loggerConfig.level).toBe('info');

    // Verifica o formato JSON no logger raiz ou no transport
    // O combine(timestamp(), json()) é o esperado
    expect(loggerConfig.format).toBeDefined();
  });

  it('Stream deve encaminhar mensagens para logger.info removendo quebras de linha', async () => {
    const { stream, logger } = await import('../logger');
    
    const message = 'HTTP GET /api/v1/health 200\n';
    stream.write(message);

    expect(logger.info).toHaveBeenCalledWith('HTTP GET /api/v1/health 200');
  });
});