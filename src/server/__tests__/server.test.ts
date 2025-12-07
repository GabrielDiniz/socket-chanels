import request from 'supertest';
import { Server } from 'socket.io';

// Mocks do env para garantir ambiente controlado NESTE arquivo
jest.mock('../config/env', () => ({
  env: {
    PORT: 3000,
    CORS_ORIGIN: '*',
    NODE_ENV: 'test',
    NEXT_ENABLED: false,
  },
}));

describe('App Factory (createApp)', () => {
  let appInstance: any;
  let httpServer: any;
  let ioInstance: any;

  beforeAll(async () => {
    // Import dinâmico da factory para garantir que os mocks sejam aplicados
    const { createApp } = await import('../app');
    
    const instance = await createApp();
    appInstance = instance.expressApp;
    httpServer = instance.httpServer;
    ioInstance = instance.io;
  });

  afterAll((done) => {
    // Só fechamos o IO, pois o httpServer não foi iniciado com .listen() manualmente neste teste
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
    // O método listen existe, mesmo que não tenha sido chamado
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

  it('Deve responder à rota raiz ("/") em modo API Only', async () => {
    const res = await request(appInstance).get('/');
    
    expect(res.status).toBe(200);
    expect(res.text).toContain('Painel de Chamada — API Only');
  });
});