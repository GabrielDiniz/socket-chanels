import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createMockChannel } from '../test-utils';
import { prisma } from '../../config/prisma';

let app: any;
let httpServer: any;
let io: any;

describe('Integração: Histórico de Chamadas', () => {
  beforeAll(async () => {
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
    
    await prisma.call.createMany({
      data: [
        {
          channelId: channel.id,
          patientName: 'P1',
          destination: 'D1',
          sourceSystem: 'Versa',
          calledAt: new Date(Date.now() - 10000), // 10s atrás
        },
        {
          channelId: channel.id,
          patientName: 'P2',
          destination: 'D2',
          sourceSystem: 'Versa',
          calledAt: new Date(), // Agora (mais recente)
        },
      ],
    });

    // 2. Ação: GET history
    const res = await request(app)
      .get('/api/v1/channels/recepcao-hist/history')
      .expect(200);

    // 3. Asserção
    expect(res.body.success).toBe(true);
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[0].name).toBe('P2'); // Ordenação DESC
    expect(res.body.history[1].name).toBe('P1');
  });

  it('Deve retornar 404 se o canal não existir', async () => {
    await request(app)
      .get('/api/v1/channels/nao-existe/history')
      .expect(404);
  });

  it('Deve retornar lista vazia se canal não tiver chamadas', async () => {
    await createMockChannel({ slug: 'vazio' });

    const res = await request(app)
      .get('/api/v1/channels/vazio/history')
      .expect(200);

    expect(res.body.history).toEqual([]);
  });
});