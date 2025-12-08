import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase } from '../test-utils';
import { prisma } from '../../config/prisma';

// Variável para armazenar a instância do app express
let app: any;
let httpServer: any;
let io: any;

const SYSTEM_API_KEY = process.env.API_SECRET || 'supersecretkey12345';

describe('Integração: API Super Admin (Tenants)', () => {
  
  beforeAll(async () => {
    process.env.API_SECRET = SYSTEM_API_KEY;
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    io.close();
    httpServer.close();
  });

  describe('Autenticação', () => {
    it('Deve negar acesso sem x-admin-key (401)', async () => {
      await request(app).get('/api/v1/admin/tenants').expect(401);
    });

    it('Deve negar acesso com x-admin-key incorreta (403)', async () => {
      await request(app)
        .get('/api/v1/admin/tenants')
        .set('x-admin-key', 'wrong-key')
        .expect(403);
    });
  });

  describe('Gestão de Tenants', () => {
    it('Deve criar um novo tenant com sucesso (201)', async () => {
      const payload = {
        name: 'Hospital São Lucas',
        slug: 'hosp-sao-lucas',
      };

      const res = await request(app)
        .post('/api/v1/admin/tenants')
        .set('x-admin-key', SYSTEM_API_KEY)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.tenant.apiToken).toBeDefined();
      expect(res.body.tenant.slug).toBe(payload.slug);

      // Verifica persistência
      const dbTenant = await prisma.tenant.findUnique({ where: { slug: payload.slug } });
      expect(dbTenant).not.toBeNull();
    });

    it('Deve impedir criação de tenant com slug duplicado (409)', async () => {
      // 1. Cria o primeiro
      await prisma.tenant.create({
        data: { name: 'Original', slug: 'duplicado', apiToken: 'token1' }
      });

      // 2. Tenta criar o segundo
      await request(app)
        .post('/api/v1/admin/tenants')
        .set('x-admin-key', SYSTEM_API_KEY)
        .send({ name: 'Cópia', slug: 'duplicado' })
        .expect(409);
    });

    it('Deve listar tenants cadastrados (200)', async () => {
      await prisma.tenant.createMany({
        data: [
          { name: 'T1', slug: 't1', apiToken: 'k1' },
          { name: 'T2', slug: 't2', apiToken: 'k2' },
        ]
      });

      const res = await request(app)
        .get('/api/v1/admin/tenants')
        .set('x-admin-key', SYSTEM_API_KEY)
        .expect(200);

      expect(res.body.tenants).toHaveLength(2);
      expect(res.body.tenants[0]).not.toHaveProperty('apiToken'); // Segurança
    });

    it('Deve rotacionar a chave de um tenant (200)', async () => {
      const tenant = await prisma.tenant.create({
        data: { name: 'Rotacionar', slug: 'rot-key', apiToken: 'old-key' }
      });

      const res = await request(app)
        .post(`/api/v1/admin/tenants/${tenant.id}/rotate-key`)
        .set('x-admin-key', SYSTEM_API_KEY)
        .expect(200);

      expect(res.body.apiToken).not.toBe('old-key');
      
      const updated = await prisma.tenant.findUnique({ where: { id: tenant.id } });
      expect(updated?.apiToken).toBe(res.body.apiToken);
    });

    it('Deve retornar 404 ao tentar rotacionar chave de ID inexistente', async () => {
      await request(app)
        .post('/api/v1/admin/tenants/non-existent-id/rotate-key')
        .set('x-admin-key', SYSTEM_API_KEY)
        .expect(404);
    });
  });
});