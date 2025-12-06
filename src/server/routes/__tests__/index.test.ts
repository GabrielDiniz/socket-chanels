import { SocketService } from '../../services/socket.service';

// Mock dos controllers
jest.mock('../../controllers/channel.controller', () => ({
  __esModule: true,
  channelController: jest.fn((req, res) => res.end()),
}));

jest.mock('../../controllers/ingest.controller', () => ({
  __esModule: true,
  authMiddleware: jest.fn((req, res, next) => next()),
  // Retorna uma função (RequestHandler) para satisfazer o Router
  createIngestController: jest.fn().mockReturnValue((req: any, res: any) => res.end()),
}));

describe('Routes', () => {
  let routerMock: any;
  let mockSocketService: SocketService;
  let createRoutes: any;

  beforeEach(() => {
    jest.resetModules();

    routerMock = {
      post: jest.fn(),
    };
    
    // Mock manual do Express Router
    jest.mock('express', () => ({
      __esModule: true,
      Router: jest.fn(() => routerMock),
    }));

    // Importa o módulo sob teste
    const routesModule = require('../index');
    createRoutes = routesModule.createRoutes;

    mockSocketService = {} as SocketService;
  });

  it('createRoutes deve registrar POST /register com channelController', () => {
    const { channelController } = require('../../controllers/channel.controller');
    
    createRoutes(mockSocketService);

    expect(routerMock.post).toHaveBeenCalledWith(
      '/register',
      channelController
    );
  });

  it('createRoutes deve registrar POST /chamada com authMiddleware e ingestController', () => {
    const { authMiddleware, createIngestController } = require('../../controllers/ingest.controller');
    
    createRoutes(mockSocketService);

    expect(createIngestController).toHaveBeenCalledWith(mockSocketService);

    // O terceiro argumento é o resultado de createIngestController(), que é a função retornada pelo mock
    expect(routerMock.post).toHaveBeenCalledWith(
      '/chamada',
      authMiddleware,
      expect.any(Function)
    );
  });
});