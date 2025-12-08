import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase } from '../test-utils';
import { prisma } from '../../config/prisma';
import { randomUUID } from 'crypto';

let app: any;
let httpServer: any;
let io: any;

describe('Integração: Gestão de Canais (Tenant Scoped)', () => {
  // Dados do Tenant de teste principal
  const tenantData = {
    name: 'Hospital São João',
    slug: 'hosp-sao-joao',
    apiToken: 'tenant-token-valid',
  };

  beforeAll(async () => {
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;
  });

  beforeEach(async () => {
    await resetDatabase();
    // Cria o tenant principal
    await prisma.tenant.create({
      data: { ...tenantData, isActive: true }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    io.close();
    httpServer.close();
  });

  describe('Autenticação', () => {
    it('Deve negar acesso sem header x-tenant-token (401)', async () => {
      await request(app).get('/api/v1/tenant/channels').expect(401);
    });

    it('Deve negar acesso com token inválido (401)', async () => {
      await request(app)
        .get('/api/v1/tenant/channels')
        .set('x-tenant-token', 'wrong-token')
        .expect(401);
    });
  });

  describe('CRUD Canais', () => {
    it('Deve criar um canal vinculado ao tenant (201)', async () => {
      const payload = { slug: 'recepcao-emergencia', name: 'Recepção Emergência' };

      const res = await request(app)
        .post('/api/v1/tenant/channels')
        .set('x-tenant-token', tenantData.apiToken)
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.channel.slug).toBe(payload.slug);
      
      // Valida no banco se o tenantId foi vinculado corretamente
      const dbChannel = await prisma.channel.findUnique({ 
        where: { slug: payload.slug },
        include: { tenant: true }
      });
      expect(dbChannel?.tenant?.slug).toBe(tenantData.slug);
    });

    it('Deve listar apenas os seus canais (200)', async () => {
      const myTenant = await prisma.tenant.findUnique({ where: { slug: tenantData.slug } });
      
      // Canal do Tenant 1
      await prisma.channel.create({
        data: { slug: 'meu-c1', name: 'Meu', apiKey: randomUUID(), tenantId: myTenant!.id }
      });

      // Tenant 2 e seu canal
      const otherTenant = await prisma.tenant.create({
        data: { name: 'Outro', slug: 'outro', apiToken: 'token2' }
      });
      await prisma.channel.create({
        data: { slug: 'outro-c1', name: 'Outro', apiKey: randomUUID(), tenantId: otherTenant.id }
      });

      const res = await request(app)
        .get('/api/v1/tenant/channels')
        .set('x-tenant-token', tenantData.apiToken)
        .expect(200);

      expect(res.body.channels).toHaveLength(1);
      expect(res.body.channels[0].slug).toBe('meu-c1');
    });

    it('Deve atualizar nome do canal (200)', async () => {
      const myTenant = await prisma.tenant.findUnique({ where: { slug: tenantData.slug } });
      await prisma.channel.create({
        data: { slug: 'edit-me', name: 'Original', apiKey: randomUUID(), tenantId: myTenant!.id }
      });

      const res = await request(app)
        .patch('/api/v1/tenant/channels/edit-me')
        .set('x-tenant-token', tenantData.apiToken)
        .send({ name: 'Atualizado' })
        .expect(200);

      expect(res.body.channel.name).toBe('Atualizado');
    });

    it('Deve deletar (desativar) canal (200)', async () => {
      const myTenant = await prisma.tenant.findUnique({ where: { slug: tenantData.slug } });
      await prisma.channel.create({
        data: { slug: 'del-me', name: 'Lixo', apiKey: randomUUID(), tenantId: myTenant!.id, isActive: true }
      });

      await request(app)
        .delete('/api/v1/tenant/channels/del-me')
        .set('x-tenant-token', tenantData.apiToken)
        .expect(200);

      const deleted = await prisma.channel.findUnique({ where: { slug: 'del-me' } });
      expect(deleted?.isActive).toBe(false);
    });
  });

  describe('Isolamento de Dados (Security)', () => {
    it('Deve impedir edição de canal de outro tenant (404)', async () => {
      // Cria outro tenant com um canal
      const otherTenant = await prisma.tenant.create({
        data: { name: 'Vítima', slug: 'vitima', apiToken: 'token-victim' }
      });
      await prisma.channel.create({
        data: { slug: 'canal-vitima', name: 'Alvo', apiKey: randomUUID(), tenantId: otherTenant.id }
      });

      // Tenta editar usando o token do tenant principal (atacante)
      await request(app)
        .patch('/api/v1/tenant/channels/canal-vitima')
        .set('x-tenant-token', tenantData.apiToken)
        .send({ name: 'Hacked' })
        .expect(404); // Deve retornar Not Found para não vazar existência
    });

    it('Deve impedir deleção de canal de outro tenant (404)', async () => {
      const otherTenant = await prisma.tenant.create({
        data: { name: 'Vítima 2', slug: 'vitima2', apiToken: 'token-victim2' }
      });
      await prisma.channel.create({
        data: { slug: 'canal-vitima-del', name: 'Alvo', apiKey: randomUUID(), tenantId: otherTenant.id }
      });

      await request(app)
        .delete('/api/v1/tenant/channels/canal-vitima-del')
        .set('x-tenant-token', tenantData.apiToken)
        .expect(404);
    });
  });
});