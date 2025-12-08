import { Request, Response, NextFunction } from 'express';
import { tenantAuthMiddleware } from '../tenant.auth';
import { tenantService } from '../../services/tenant.service';

// Mock do tenantService
jest.mock('../../services/tenant.service', () => ({
  tenantService: {
    findByApiToken: jest.fn(),
  },
}));

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  return res;
};

describe('Tenant Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, ip: '127.0.0.1' };
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('Deve chamar next() e anexar tenant ao req se token for válido', async () => {
    req.headers = { 'x-tenant-token': 'valid-token' };
    const mockTenant = { id: 't1', name: 'Tenant X', slug: 'tenant-x' };
    
    (tenantService.findByApiToken as jest.Mock).mockResolvedValue(mockTenant);

    await tenantAuthMiddleware(req as Request, res, next);

    expect(tenantService.findByApiToken).toHaveBeenCalledWith('valid-token');
    expect((req as any).tenant).toEqual(mockTenant);
    expect(next).toHaveBeenCalled();
  });

  it('Deve retornar 401 se o header estiver ausente', async () => {
    await tenantAuthMiddleware(req as Request, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('Deve retornar 401 se o token for inválido ou tenant inativo', async () => {
    req.headers = { 'x-tenant-token': 'invalid-token' };
    (tenantService.findByApiToken as jest.Mock).mockResolvedValue(null);

    await tenantAuthMiddleware(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('Deve retornar 500 se o serviço falhar', async () => {
    req.headers = { 'x-tenant-token': 'valid-token' };
    (tenantService.findByApiToken as jest.Mock).mockRejectedValue(new Error('DB Fail'));

    await tenantAuthMiddleware(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});