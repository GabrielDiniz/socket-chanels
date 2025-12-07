import request from 'supertest';
import { prisma } from '../../config/prisma';
import { resetDatabase, createMockChannel } from '../test-utils';

describe('Integração: Histórico de Chamadas', () => {
  let app: any;
  let httpServer: any;
  let io: any;

  beforeAll(async () => {
    const { createApp } = await import('../../app');
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll((done) => {
    io.close(() => {
      httpServer.close(async () => {
        await prisma.$disconnect();
        done();
      });
    });
  });

  it('Deve retornar as últimas chamadas de um canal (200)', async () => {
    // 1. Setup: Canal e Chamadas
    const channel = await createMockChannel({ slug: 'recepcao-hist' });
    
    // Cria 15 chamadas para testar paginação/limite (default esperado: 10 ou 50)
    for (let i = 1; i <= 15; i++) {
      await prisma.call.create({
        data: {
          channelId: channel.id,
          patientName: `Paciente ${i}`,
          destination: `Guichê ${i}`,
          sourceSystem: 'Test',
          // Data crescente para garantir ordem
          calledAt: new Date(Date.now() + i * 1000), 
        }
      });
    }

    // 2. Executar Request
    const response = await request(app)
      .get(`/api/v1/channels/${channel.slug}/history`)
      .expect(200);

    // 3. Validações
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.history)).toBe(true);
    
    // Deve retornar as mais recentes primeiro
    const history = response.body.history;
    expect(history.length).toBeGreaterThan(0);
    // Valida ordenação (mais recente primeiro -> índice 0 deve ser Paciente 15)
    expect(history[0].name).toBe('Paciente 15');
  });

  it('Deve retornar 404 se o canal não existir', async () => {
    await request(app)
      .get('/api/v1/channels/slug-inexistente/history')
      .expect(404);
  });

  it('Deve retornar lista vazia se canal não tiver chamadas', async () => {
    const channel = await createMockChannel({ slug: 'vazio' });

    const response = await request(app)
      .get(`/api/v1/channels/${channel.slug}/history`)
      .expect(200);

    expect(response.body.history).toHaveLength(0);
  });
});