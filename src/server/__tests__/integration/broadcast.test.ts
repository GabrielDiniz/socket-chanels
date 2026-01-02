import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createMockChannel } from '../test-utils';
import { prisma } from '../../config/prisma';
import { createSocketClient, sleep } from '../test-utils';
import { generateToken } from '../../utils/jwt.utils';

let app: any;
let httpServer: any;
let io: any;

describe('Integração: Ingestão e Broadcast', () => {
  beforeAll(async () => {
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;

    // Start server on a random port for socket client to connect
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        resolve();
      });
    });
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

  it('Deve persistir chamada e emitir evento via Socket.IO', (done) => {
    (async () => {
      try {
        // 1. Setup: Criar Canal no Banco com API Key EXPLÍCITA
        const channel = await createMockChannel({
          slug: 'sala-espera-01',
          name: 'Sala 01',
          apiKey: 'test-api-key-123' 
        });

        // 2. Setup: Cliente Socket.IO conecta e entra na sala
        const address = httpServer.address();
        const port = typeof address === 'string' ? 0 : address?.port;
        
        if (!port) {
          throw new Error('Server port not found');
        }

        const clientSocket = createSocketClient(port);

        // Gera token JWT válido para o teste usando a apiKey do canal
        const token = generateToken({ role: 'test' }, channel.apiKey);

        // Configura auth no handshake
        clientSocket.auth = { token, channelSlug: channel.slug };

        await new Promise<void>((resolve) => {
          clientSocket.on('connect', () => {
            clientSocket.emit('join_channel', 'sala-espera-01');
            resolve();
          });
        });

        // Aguarda um pouco para garantir o join
        await sleep(100);

        // 3. Ação: Enviar POST de Ingestão (Versa)
        const payload = {
          source_system: 'Versa',
          current_call: {
            patient_name: 'Maria Silva',
            destination: 'Consultório 10',
            professional_name: 'Dr. Santos',
          },
        };

        // Escuta o evento no cliente socket
        clientSocket.on('call_update', (data) => {
          try {
            // 4. Asserção: O evento recebido deve bater com o payload
            expect(data).toMatchObject({
              name: 'Maria Silva',
              destination: 'Consultório 10',
              professional: 'Dr. Santos',
              rawSource: 'Versa',
              isPriority: false,
            });
            expect(data.id).toBeDefined();
            
            clientSocket.close();
            done(); // Teste passa!
          } catch (err) {
            clientSocket.close();
            done(err);
          }
        });

        // Dispara a chamada HTTP
        await request(app)
          .post('/api/v1/chamada')
          .set('x-auth-token', 'test-api-key-123')
          .set('x-channel-id', 'sala-espera-01')
          .send(payload)
          .expect(200);

      } catch (err) {
        done(err);
      }
    })();
  });

  it('Deve rejeitar chamada para canal inexistente (401)', async () => {
    await request(app)
      .post('/api/v1/chamada')
      .set('x-auth-token', 'invalid')
      .set('x-channel-id', 'canal-fantasma')
      .send({})
      .expect(401);
  });
});