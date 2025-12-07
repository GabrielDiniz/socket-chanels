import request from 'supertest';
import { prisma } from '../../config/prisma';
import { resetDatabase, createMockChannel, createSocketClient } from '../test-utils';
import { Socket as ClientSocket } from 'socket.io-client';

describe('Integração: Ingestão e Broadcast', () => {
  let app: any;
  let httpServer: any;
  let io: any;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll(async () => {
    // Importa a factory dinamicamente
    const { createApp } = await import('../../app');
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;

    // Inicia o servidor em uma porta aleatória para permitir conexão real do socket client
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const addr = httpServer.address();
        port = typeof addr === 'string' ? 0 : addr?.port || 0;
        resolve();
      });
    });
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    done();
  });

  afterAll((done) => {
    io.close(() => {
      httpServer.close(async () => {
        await prisma.$disconnect();
        done();
      });
    });
  });

  it('Deve persistir chamada e emitir evento via Socket.IO', (done) => {
    (async () => {
      try {
        // 1. Setup: Criar Canal no Banco com API Key EXPLÍCITA
        // Isso evita ambiguidades de geração de UUID durante o teste
        const TEST_API_KEY = 'test-api-key-123-secure';
        const channel = await createMockChannel({ 
          slug: 'sala-espera-01',
          apiKey: TEST_API_KEY,
          isActive: true
        });

        // 2. Conectar Cliente Socket
        clientSocket = createSocketClient(port);
        
        await new Promise<void>((resolve) => {
          clientSocket.on('connect', () => {
            clientSocket.emit('join_channel', channel.slug);
            setTimeout(resolve, 50);
          });
        });

        // 3. Preparar listener para o evento esperado
        const socketEventPromise = new Promise<any>((resolve) => {
          clientSocket.on('call_update', (data) => {
            resolve(data);
          });
        });

        // 4. Executar chamada API (Ingestão)
        const payload = {
          source_system: 'VersaTest',
          current_call: {
            patient_name: 'Maria Silva',
            destination: 'Consultório 10',
            professional_name: 'Dr. Santos'
          }
        };

        const apiResponse = await request(app)
          .post('/api/v1/chamada')
          .set('x-auth-token', TEST_API_KEY) // Usa a chave explícita
          .set('x-channel-id', channel.slug)
          .send(payload)
          .expect(200);

        expect(apiResponse.body.success).toBe(true);
        expect(apiResponse.body.data.call.name).toBe('Maria Silva');

        // 5. Aguardar e validar o evento do Socket
        const socketData = await socketEventPromise;
        expect(socketData).toBeDefined();
        expect(socketData.name).toBe('Maria Silva');
        expect(socketData.destination).toBe('Consultório 10');
        expect(socketData.id).toBeDefined();

        // 6. Validação final: Banco de Dados
        const callInDb = await prisma.call.findFirst({
          where: { channelId: channel.id }
        });
        expect(callInDb).not.toBeNull();
        expect(callInDb?.patientName).toBe('Maria Silva');

        done();
      } catch (err) {
        done(err);
      }
    })();
  });

  it('Deve rejeitar chamada para canal inexistente (401)', async () => {
    await request(app)
      .post('/api/v1/chamada')
      .set('x-auth-token', 'chave-invalida')
      .set('x-channel-id', 'canal-fantasma')
      .send({ some: 'data' })
      .expect(401);
  });
});