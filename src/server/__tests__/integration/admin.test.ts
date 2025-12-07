import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase } from '../test-utils';
import { prisma } from '../../config/prisma';

// Variável para armazenar a instância do app express
let app: any;
let httpServer: any;
let io: any;

// A chave mestra deve corresponder ao que está no .env de teste ou ser forçada aqui
// No docker-compose.override.yml, passamos a env. Vamos garantir que o teste use o valor correto.
// Se não estiver definida, usamos o valor default do env.ts
const REGISTRATION_KEY = process.env.CHANNEL_REGISTRATION_KEY || 'supersecretkey12345';

describe('Integração: Admin / Registro de Canais', () => {
  
  // Setup global do suite
  beforeAll(async () => {
    // Força a chave no ambiente do processo atual para garantir que o server.ts pegue este valor
    process.env.CHANNEL_REGISTRATION_KEY = REGISTRATION_KEY;
    
    // Inicializa a aplicação
    const instance = await createApp();
    app = instance.expressApp;
    httpServer = instance.httpServer;
    io = instance.io;
  });

  // Limpeza antes de CADA teste
  beforeEach(async () => {
    await resetDatabase();
  });

  // Teardown global
  afterAll(async () => {
    await prisma.$disconnect();
    io.close();
    httpServer.close();
  });

  it('Deve registrar um novo canal com sucesso (201)', async () => {
    const payload = {
      slug: 'recepcao-nova',
      name: 'Recepção Nova',
      system: 'NovoSGA',
      registration_key: REGISTRATION_KEY
    };

    const response = await request(app)
      .post('/api/v1/register')
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(201);

    // Validações da resposta HTTP
    expect(response.body.success).toBe(true);
    expect(response.body.channel).toHaveProperty('apiKey');
    expect(response.body.channel.slug).toBe(payload.slug);

    // Validação de Persistência (Banco de Dados)
    const channelInDb = await prisma.channel.findUnique({
      where: { slug: payload.slug }
    });
    expect(channelInDb).not.toBeNull();
    expect(channelInDb?.name).toBe(payload.name);
  });

  it('Deve impedir registro com chave inválida (401)', async () => {
    const payload = {
      slug: 'hacker-channel',
      name: 'Hacker',
      system: 'HackSystem',
      registration_key: 'chave-errada-definitivamente'
    };

    await request(app)
      .post('/api/v1/register')
      .send(payload)
      .expect(401);
      
    // Garante que NÃO salvou no banco
    const channelInDb = await prisma.channel.findUnique({
      where: { slug: payload.slug }
    });
    expect(channelInDb).toBeNull();
  });

  it('Deve impedir duplicidade de slugs (409)', async () => {
    // 1. Cria o primeiro canal (Caminho Feliz)
    await request(app)
      .post('/api/v1/register')
      .send({
        slug: 'duplicado',
        name: 'Original',
        system: 'SGA',
        registration_key: REGISTRATION_KEY
      })
      .expect(201);

    // 2. Tenta criar o segundo com mesmo slug (Erro de Conflito)
    const response = await request(app)
      .post('/api/v1/register')
      .send({
        slug: 'duplicado',
        name: 'Cópia',
        system: 'SGA',
        registration_key: REGISTRATION_KEY
      })
      .expect(409);

    expect(response.body.error).toBe('Conflict');
  });

  it('Deve validar formato do slug (400)', async () => {
    const payload = {
      slug: 'Nome Inválido Com Espaços', // Slug deve ser slug-case
      name: 'Teste',
      system: 'SGA',
      registration_key: REGISTRATION_KEY
    };

    await request(app)
      .post('/api/v1/register')
      .send(payload)
      .expect(400); // Bad Request do Zod
  });
});