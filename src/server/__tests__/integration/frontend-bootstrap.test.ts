// src/server/__tests__/integration/frontend-bootstrap.test.ts — Testes de integração para bootstrap híbrido Next.js + Express (cleanup robusto anti-leak)

import request from 'supertest';
import { createApp } from '../../app';
import { env } from '../../config/env';

// Mock env pra forçar modo híbrido nos testes
jest.mock('../../config/env', () => ({
  env: {
    ...process.env,
    PORT: 3001,
    NEXT_ENABLED: true,
    CORS_ORIGIN: '*',
    API_SECRET: 'test-secret',
  },
}));

describe('Frontend Bootstrap Integration', () => {
  let app: any;
  let httpServer: any;
  let io: any;

  beforeAll(async () => {
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;
  });

  it('GET / deve redirecionar para /panel quando NEXT_ENABLED é true', async () => {
    const response = await request(app).get('/');
    
    expect([301, 302, 307, 308]).toContain(response.status);
    expect(response.header.location).toBe('/panel');
  });

  it('GET /panel não deve retornar a mensagem de "API Only"', async () => {
    const response = await request(app).get('/panel');
    
    expect(response.status).not.toBe(404);
    if (response.text) {
      expect(response.text).not.toContain('Frontend desativado');
      expect(response.text).not.toContain('API Only');
    }
  });

  // Cleanup anti-leak: io sync primeiro, httpServer async com promise robusta, try/catch silencioso
  afterAll(async () => {
    try {
      if (io) {
        io.close(); // Libera engine e clients sync (mata timers internos)
      }
      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((err?: Error) => {
            if (err) {
              console.warn('Warning: Erro ao fechar httpServer (ignorado em teste):', err.message);
              resolve(); // Ignora erro, não trava Jest
            } else {
              resolve();
            }
          });
        });
      }
    } catch (err) {
      console.warn('Warning: Exceção no cleanup (ignorado):', (err as Error).message);
    }
  });
});