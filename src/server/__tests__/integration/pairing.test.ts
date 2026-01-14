import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase } from '../test-utils';
import { prisma } from '../../config/prisma';
import jwt from 'jsonwebtoken';
let app: any;
let httpServer: any;
let io: any;
let pairingService: any;

beforeAll(async () => {
  const instance = await createApp();
  app = instance.expressApp;
  httpServer = instance.httpServer;
  io = instance.io;
  pairingService = instance.pairingService;

  jest.spyOn(io, 'to').mockReturnThis();
  jest.spyOn(io, 'emit').mockImplementation(() => io);
});

beforeEach(async () => {
  await resetDatabase();
  jest.clearAllMocks();
});

afterAll(async () => {
  if (io) io.close();
  if (httpServer) httpServer.close();
  await prisma.$disconnect();
});

describe('Integração: Pareamento Realtime Backend (Validate Code + Emit Paired)', () => {
  const ADMIN_KEY = process.env.API_SECRET || 'test-admin-key';

  const createMockChannel = async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'Test Tenant', slug: 'test-tenant', apiToken: 'test-token' } });
    return prisma.channel.create({
      data: {
        slug: 'recepcao-test',
        name: 'Recepção Test',
        apiKey: 'channel-token-real',
        tenantId: tenant.id,
      },
    });
  };

  it('Deve validar code válido, emit "paired" to temp room, e retornar 200', async () => {
    const channel = await createMockChannel();
     const jwtToken = jwt.sign(
          { role: 'client', channel: channel.slug }, 
          channel.apiKey, 
          { expiresIn: '24h' }
        );
    // Register temp code (real flow TV socket, for test manual)
    pairingService.registerTempCode('123456');

    const res = await request(app)
      .post('/api/v1/admin/pairing/validate')
      .set('x-admin-key', ADMIN_KEY)
      .send({ code: '123456', channelSlug: channel.slug })
      .expect(200);

    expect(res.body.success).toBe(true);

    expect(io.to).toHaveBeenCalledWith('pairing-123456');
    expect(io.emit).toHaveBeenCalledWith('paired', {
      slug: channel.slug,
      token: jwtToken,
    });
  });

  it('Deve retornar 410 para code inválido/expirado', async () => {
    const channel = await createMockChannel();

    // Register temp code, but use invalid code for test
    pairingService.registerTempCode('valid-code');

    await request(app)
      .post('/api/v1/admin/pairing/validate')
      .set('x-admin-key', ADMIN_KEY)
      .send({ code: '000000', channelSlug: channel.slug })
      .expect(410);
  });
});