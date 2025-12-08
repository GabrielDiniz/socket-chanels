import { Request, Response, NextFunction } from 'express';
import { adminAuthMiddleware } from '../admin.auth';

// Mock do env
jest.mock('../../config/env', () => ({
  env: {
    API_SECRET: 'secret-admin-key',
  },
}));

// Helper para mockar Response
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn();
  return res;
};

describe('Admin Auth Middleware', () => {
  let req: Partial<Request>;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, ip: '127.0.0.1' };
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('Deve chamar next() se a chave for válida', () => {
    req.headers = { 'x-admin-key': 'secret-admin-key' };
    adminAuthMiddleware(req as Request, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('Deve retornar 401 se o header estiver ausente', () => {
    adminAuthMiddleware(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('Deve retornar 403 se a chave for incorreta', () => {
    req.headers = { 'x-admin-key': 'wrong-key' };
    adminAuthMiddleware(req as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Forbidden' }));
    expect(next).not.toHaveBeenCalled();
  });
});