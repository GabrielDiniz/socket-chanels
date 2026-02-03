import request from 'supertest';
import { Server } from 'socket.io';

// 1. Mock do ambiente
jest.mock('../config/env', () => ({
  env: {
    PORT: 3000,
    CORS_ORIGIN: '*',
    NODE_ENV: 'test',
    NEXT_ENABLED: false,
  },
}));

// 2. Mock do Controller E Middleware
// Isso é crucial: O arquivo de rotas importa { authMiddleware, createIngestController }
// Precisamos garantir que ambos sejam funções válidas durante o teste de bootstrap.
jest.mock('../controllers/ingest.controller', () => ({
  // Factory retorna um handler express simples
  createIngestController: jest.fn(() => (req: any, res: any) => res.status(200).json({ status: 'mocked' })),
  // Middleware pass-through para não bloquear os testes de rota básica
  authMiddleware: (req: any, res: any, next: any) => next(),
}));

describe('App Factory (createApp)', () => {
  let appInstance: any;
  let httpServer: any;
  let ioInstance: any;

  beforeAll(async () => {
    // Import dinâmico para garantir que os mocks acima sejam aplicados antes do import do app
    const { createApp } = await import('../app');
    
    const instance = await createApp();
    appInstance = instance.expressApp;
    httpServer = instance.httpServer;
    ioInstance = instance.io;
  });

  afterAll((done) => {
    if (ioInstance) {
      ioInstance.close(() => done());
    } else {
      done();
    }
  });

  it('Deve inicializar o Express corretamente', () => {
    expect(appInstance).toBeDefined();
    expect(typeof appInstance.use).toBe('function');
  });

  it('Deve inicializar o servidor HTTP', () => {
    expect(httpServer).toBeDefined();
    expect(typeof httpServer.listen).toBe('function');
  });

  it('Deve anexar o Socket.IO ao servidor HTTP', () => {
    expect(ioInstance).toBeDefined();
    expect(ioInstance).toBeInstanceOf(Server);
    expect(ioInstance.httpServer).toBe(httpServer);
  });

  it('Deve responder ao Healthcheck (/health)', async () => {
    const res = await request(appInstance).get('/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('Deve responder à rota raiz ("/")', async () => {
    const res = await request(appInstance).get('/');
    // Verifica apenas se responde, o status code exato depende da config do App (404 se API Only)
    expect(res.status).toBeDefined(); 
  });
});