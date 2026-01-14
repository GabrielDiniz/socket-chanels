import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Mock do módulo Next.js para as linhas 54-65
const mockNextHandler = jest.fn((req, res) => res.status(200).send('Next.js Response'));
jest.mock('next', () => {
  return jest.fn(() => ({
    prepare: jest.fn().mockResolvedValue(true),
    getRequestHandler: jest.fn(() => mockNextHandler),
  }));
});

// Mock das variáveis de ambiente
jest.mock('../config/env', () => ({
  env: {
    NEXT_ENABLED: true,
    NODE_ENV: 'development',
    CORS_ORIGIN: '*',
  },
}));

jest.mock('../config/logger');

describe('App Coverage - Next.js Integration & Stubs', () => {
  let originalJestWorkerId: string | undefined;

  beforeAll(() => {
    originalJestWorkerId = process.env.JEST_WORKER_ID;
  });

  afterAll(() => {
    process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  /**
   * Cobertura Linhas 85-90: Admin Stub
   * Testa a rota /admin quando NEXT_ENABLED é true mas o nextHandler ainda não foi definido (cenário padrão em Jest)
   */
  it('deve renderizar o stub do admin quando o frontend está ativo mas o nextHandler é nulo', async () => {
    const { expressApp } = await createApp();
    const res = await request(expressApp).get('/admin');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Admin Stub - Frontend Ativo');
  });

  /**
   * Cobertura Linhas 54-65 e 96-98: Sucesso na Inicialização do Next.js e Fallback
   * Remove temporariamente o JEST_WORKER_ID para entrar no bloco de inicialização
   */
  it('deve inicializar o Next.js com sucesso e usar o fallback para rotas desconhecidas', async () => {
    // Força a entrada no bloco if (env.NEXT_ENABLED && !process.env.JEST_WORKER_ID)
    delete process.env.JEST_WORKER_ID;

    const { expressApp } = await createApp();
    
    // Verifica se o logger reportou sucesso (Linha 65)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Next.js preparado'));

    // Testa o Fallback (Linhas 96-98) - Qualquer rota não definida deve cair no nextHandler
    const res = await request(expressApp).get('/rota-aleatoria-do-next');
    expect(res.status).toBe(200);
    expect(res.text).toBe('Next.js Response');

    // Restaura para os próximos testes
    process.env.JEST_WORKER_ID = originalJestWorkerId;
  });

  /**
   * Cobertura Linhas 67-71: Falha na Inicialização do Next.js
   * Simula um erro no método prepare() do Next.js
   */
  it('deve capturar erro e registrar no logger quando o Next.js falhar ao preparar', async () => {
    delete process.env.JEST_WORKER_ID;
    const next = require('next');
    // Força o erro no prepare()
    next.mockImplementationOnce(() => ({
      prepare: jest.fn().mockRejectedValue(new Error('Next.js Crash')),
      getRequestHandler: jest.fn(),
    }));

    await createApp();

    // Verifica se o erro foi logado (Linhas 68-70)
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao inicializar Next.js'),
      expect.objectContaining({ error: 'Next.js Crash' })
    );

    process.env.JEST_WORKER_ID = originalJestWorkerId;
  });
  it('deve retornar o modo "hybrid" quando NEXT_ENABLED for true', async () => {
    // Garante que o valor é true para este teste
    (env as any).NEXT_ENABLED = true;
    
    const { expressApp } = await createApp();
    const res = await request(expressApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('hybrid (Next.js + API)');
  });

  /**
   * Cobertura Linha 39 (Ramo Falso): NEXT_ENABLED = false
   */
  it('deve retornar o modo "API Only" quando NEXT_ENABLED for false', async () => {
    // Altera o valor para false antes de criar o app para forçar o outro ramo
    (env as any).NEXT_ENABLED = false;
    
    const { expressApp } = await createApp();
    const res = await request(expressApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('API Only');
  });
});