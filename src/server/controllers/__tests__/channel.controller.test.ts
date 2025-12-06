import { Request, Response } from 'express';
// Não importamos estaticamente o controller ou o schema para evitar cache com env antigo
// import { channelController } from '../channel.controller'; 

// Mocks globais (hoisted)
jest.mock('../../config/prisma', () => ({
  __esModule: true,
  prisma: {
    channel: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../schemas/channel.schema', () => ({
  __esModule: true,
  channelSchema: {
    parse: jest.fn(),
  },
}));

jest.mock('crypto', () => ({
  __esModule: true,
  randomUUID: jest.fn(),
}));

describe('Channel Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let channelController: any;
  let prismaMock: any;
  let schemaMock: any;
  let cryptoMock: any;

  const MOCK_REG_KEY = 'secret12345';

  beforeEach(async () => {
    // 1. Limpa o cache de módulos
    jest.resetModules();
    
    // 2. Configura a variável de ambiente
    process.env.CHANNEL_REGISTRATION_KEY = MOCK_REG_KEY;

    // 3. Re-importa dependências e o módulo sob teste
    const prismaModule = require('../../config/prisma');
    prismaMock = prismaModule.prisma;
    
    const schemaModule = require('../../schemas/channel.schema');
    schemaMock = schemaModule.channelSchema;

    const cryptoModule = require('crypto');
    cryptoMock = cryptoModule;

    const controllerModule = await require('../channel.controller');
    channelController = controllerModule.channelController;

    jest.clearAllMocks();

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    req = { body: {} };
  });

  afterEach(() => {
    delete process.env.CHANNEL_REGISTRATION_KEY;
  });

  it('Deve retornar 401 em registration_key inválida', async () => {
    schemaMock.parse.mockReturnValue({
      slug: 'teste',
      registration_key: 'wrong-key',
    });

    await channelController(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Unauthorized',
    }));
  });

  it('Deve retornar 409 em slug já existente', async () => {
    schemaMock.parse.mockReturnValue({
      slug: 'slug-existente',
      registration_key: MOCK_REG_KEY, // Chave correta
    });

    prismaMock.channel.findUnique.mockResolvedValue({ id: '1', slug: 'slug-existente' });

    await channelController(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Conflict',
    }));
  });

  it('Deve criar channel novo e retornar com apiKey e instructions', async () => {
    const input = {
      slug: 'novo-canal',
      name: 'Novo Canal',
      system: 'Versa',
      registration_key: MOCK_REG_KEY,
    };

    schemaMock.parse.mockReturnValue(input);
    prismaMock.channel.findUnique.mockResolvedValue(null);
    cryptoMock.randomUUID.mockReturnValue('new-uuid-key');
    
    prismaMock.channel.create.mockResolvedValue({
      id: 'new-id',
      slug: input.slug,
      name: input.name,
      apiKey: 'new-uuid-key',
      tenant: 'Versa',
      isActive: true,
    });

    await channelController(req as Request, res as Response);

    expect(prismaMock.channel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: input.slug,
        apiKey: 'new-uuid-key',
        tenant: 'Versa',
      }),
    });

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      message: 'Canal registrado com sucesso!',
      channel: expect.objectContaining({
        apiKey: 'new-uuid-key',
        instructions: expect.any(Object),
      }),
    });
  });

  it('Deve retornar 400 em erro Zod (body inválido)', async () => {
    const zodError = new Error('Zod Error');
    (zodError as any).name = 'ZodError';
    (zodError as any).errors = [{ message: 'Field required' }];
    
    schemaMock.parse.mockImplementation(() => {
      throw zodError;
    });

    await channelController(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('Deve tratar erros internos com 500', async () => {
    schemaMock.parse.mockReturnValue({
      slug: 'erro',
      registration_key: MOCK_REG_KEY,
    });
    
    prismaMock.channel.findUnique.mockRejectedValue(new Error('DB Down'));

    await channelController(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});