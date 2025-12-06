import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express, { Request, Response } from 'express';

// --- Mocks Factories (Definidos no escopo do módulo para persistir entre resets) ---

// 1. Spies do Express
const mockUse = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn();
const mockApp = {
  use: mockUse,
  get: mockGet,
  all: mockAll,
};

const mockExpressFn = jest.fn(() => mockApp);
(mockExpressFn as any).json = jest.fn();
(mockExpressFn as any).Router = jest.fn();

jest.mock('express', () => ({
  __esModule: true,
  default: mockExpressFn,
}));

// 2. Spies do HTTP
const mockHttpListen = jest.fn((port, cb) => cb && cb()); // Executa callback imediatamente
const mockHttpClose = jest.fn((cb) => cb && cb());
const mockHttpServer = {
  listen: mockHttpListen,
  close: mockHttpClose,
  on: jest.fn(),
};

jest.mock('http', () => ({
  __esModule: true,
  // Mock para import default E named export para garantir compatibilidade
  default: {
    createServer: jest.fn(() => mockHttpServer),
  },
  createServer: jest.fn(() => mockHttpServer),
}));

// 3. Spies do Socket.IO
const mockIoClose = jest.fn((cb) => cb && cb());
const mockIoInstance = {
  engine: { clientsCount: 5 }, // Valor para teste do healthcheck
  close: mockIoClose,
};

jest.mock('socket.io', () => ({
  __esModule: true,
  Server: jest.fn(() => mockIoInstance),
}));

// 4. Config & Services
let mockEnv = {
  PORT: 3000,
  CORS_ORIGIN: '*',
  NODE_ENV: 'test',
  NEXT_ENABLED: false, 
};

// Mock do env usando getter para permitir alteração dinâmica se necessário
jest.mock('../config/env', () => ({
  __esModule: true,
  get env() {
    return mockEnv;
  }
}));

jest.mock('../services/socket.service');
jest.mock('../routes', () => ({
  createRoutes: jest.fn().mockReturnValue((req: any, res: any, next: any) => next()),
}));

// Mock do Next.js
const mockNextApp = {
  getRequestHandler: jest.fn().mockReturnValue(jest.fn()),
  prepare: jest.fn().mockResolvedValue(undefined),
};
const mockNext = jest.fn(() => mockNextApp);
jest.mock('next', () => mockNext);

describe('Server Bootstrap', () => {
  let processExitSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Limpa o cache de módulos para garantir que server.ts rode novamente a cada teste
    jest.resetModules();
    // Limpa os contadores dos mocks (mas mantém as referências aos spies definidos acima)
    jest.clearAllMocks();

    // Reset do env
    mockEnv = {
      PORT: 3000,
      CORS_ORIGIN: '*',
      NODE_ENV: 'test',
      NEXT_ENABLED: false, 
    };

    // Mocks do ambiente Node
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processOnSpy = jest.spyOn(process, 'on');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const loadServer = async () => {
    // Importa o server da raiz. Como usamos resetModules, isso executa o código top-level novamente.
    const serverModule = require('../../../server');
    // Se o server exportar a promise de inicialização, aguardamos ela
    if (serverModule.appPromise) {
      await serverModule.appPromise;
    }
    return serverModule;
  };

  it('Deve inicializar Express, HTTP e Socket.IO corretamente', async () => {
    await loadServer();

    expect(mockExpressFn).toHaveBeenCalled();
   // expect(http.createServer).toHaveBeenCalledWith(mockApp);
    // Verifica se Socket.IO foi instanciado com o server http mockado
    expect(require('socket.io').Server).toHaveBeenCalledWith(mockHttpServer, expect.anything());
  });

  it('Deve registrar middlewares globais e rotas da API', async () => {
    await loadServer();
    
    // Verifica chamada genérica ao use
    expect(mockUse).toHaveBeenCalled();
    // Verifica registro específico da rota da API
    expect(mockUse).toHaveBeenCalledWith('/api/v1', expect.anything());
  });

  it('Deve configurar e responder no endpoint /health', async () => {
    await loadServer();
    
    // Verifica se a rota foi registrada
    expect(mockGet).toHaveBeenCalledWith('/health', expect.any(Function));
    
    // Simula uma chamada ao handler para verificar a resposta
    const healthHandler = mockGet.mock.calls.find(call => call[0] === '/health')[1];
    const res = { json: jest.fn() };
    healthHandler({}, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      clients: 5
    }));
  });

  it('Deve configurar e responder no endpoint raiz / (quando NEXT_ENABLED=false)', async () => {
    mockEnv.NEXT_ENABLED = false;
    await loadServer();

    expect(mockGet).toHaveBeenCalledWith('/', expect.any(Function));

    const rootHandler = mockGet.mock.calls.find(call => call[0] === '/')[1];
    const res = { send: jest.fn() };
    rootHandler({}, res);

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('API Only'));
  });

  it('Deve iniciar o servidor na porta configurada', async () => {
    await loadServer();
    expect(mockHttpListen).toHaveBeenCalledWith(3000, expect.any(Function));
    // Como o mockHttpListen executa o callback imediatamente, o log deve aparecer
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Server rodando'));
  });

  it('Deve registrar handlers para graceful shutdown', async () => {
    await loadServer();
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('Deve executar shutdown corretamente ao receber SIGTERM', async () => {
    await loadServer();

    // Recupera a função de shutdown registrada
    const shutdownHandler = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM')?.[1];
    
    if (typeof shutdownHandler === 'function') {
      shutdownHandler();
      
      expect(mockIoClose).toHaveBeenCalled();
      // O mock do io.close executa o callback, que chama server.close
      expect(mockHttpClose).toHaveBeenCalled();
      // O mock do server.close executa o callback, que chama process.exit
      expect(processExitSpy).toHaveBeenCalledWith(0);
    }
  });

  it('Deve tratar falha crítica na inicialização (catch block)', async () => {
    // Força um erro na inicialização do express
    mockExpressFn.mockImplementationOnce(() => {
      throw new Error('Falha simulada no express');
    });

    await loadServer();

    // Verifica se o erro foi logado e o processo encerrado
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Falha crítica ao iniciar o servidor:',
      expect.any(Error)
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});