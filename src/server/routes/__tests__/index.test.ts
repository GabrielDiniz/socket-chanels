import { SocketService } from '../../services/socket.service';

// Definição do Mock HOISTED (fora do ciclo de vida do jest)
const mockRouter = {
  post: jest.fn(),
  get: jest.fn(),
  use: jest.fn(),
  patch: jest.fn(),  // Adicionado
  delete: jest.fn(), // Adicionado
};

// Mock manual do Express Router usando a variável hoisted
jest.mock('express', () => ({
  __esModule: true,
  Router: jest.fn(() => mockRouter),
}));

// Mock dos controllers
jest.mock('../../controllers/channel.controller', () => ({
  __esModule: true,
  channelController: {
    create: jest.fn((req, res) => res.end()), // Mock do método create
  },
}));

jest.mock('../../controllers/ingest.controller', () => ({
  __esModule: true,
  authMiddleware: jest.fn((req, res, next) => next()),
  createIngestController: jest.fn().mockReturnValue((req: any, res: any) => res.end()),
}));

jest.mock('../../controllers/history.controller', () => ({
  __esModule: true,
  getChannelHistory: jest.fn((req, res) => res.end()),
}));

// Mock das rotas filhas
jest.mock('../admin.routes', () => ({
  adminRoutes: function mockAdminRoutes(req: any, res: any, next: any) { next(); }
}));

jest.mock('../tenant.routes', () => ({
  tenantRoutes: function mockTenantRoutes(req: any, res: any, next: any) { next(); }
}));

describe('Routes', () => {
  let mockSocketService: SocketService;
  let createRoutes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Importa o módulo sob teste
    const routesModule = require('../index');
    createRoutes = routesModule.createRoutes;

    mockSocketService = {} as SocketService;
  });

  it('createRoutes deve registrar rotas de admin e tenant', () => {
    const { adminRoutes } = require('../admin.routes');
    const { tenantRoutes } = require('../tenant.routes');
    
    createRoutes(mockSocketService);
    
    expect(mockRouter.use).toHaveBeenCalledWith('/admin', adminRoutes);
    expect(mockRouter.use).toHaveBeenCalledWith('/tenant', tenantRoutes);
  });

  it('createRoutes deve registrar POST /register com channelController.create', () => {
    createRoutes(mockSocketService);

    expect(mockRouter.post).toHaveBeenCalledWith(
      '/register',
      expect.any(Function) // Agora é uma arrow function wrapper
    );
  });

  it('createRoutes deve registrar POST /chamada com authMiddleware e ingestController', () => {
    const { authMiddleware, createIngestController } = require('../../controllers/ingest.controller');
    
    createRoutes(mockSocketService);

    expect(createIngestController).toHaveBeenCalledWith(mockSocketService);

    expect(mockRouter.post).toHaveBeenCalledWith(
      '/chamada',
      authMiddleware,
      expect.any(Function)
    );
  });

  it('createRoutes deve registrar GET /channels/:slug/history com getChannelHistory', () => {
    const { getChannelHistory } = require('../../controllers/history.controller');

    createRoutes(mockSocketService);

    expect(mockRouter.get).toHaveBeenCalledWith(
      '/channels/:slug/history',
      getChannelHistory
    );
  });
});