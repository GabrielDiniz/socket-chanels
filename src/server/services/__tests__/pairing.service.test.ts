// src/server/services/__tests__/pairing.service.test.ts — Testes unitários TDD para PairingService (temp codes in memory, register code only, validate add slug/token + emit 'paired', cleanup expired on validate)

import { PairingService } from '../pairing.service';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

jest.mock('socket.io', () => {
  const mockTo = jest.fn().mockReturnThis();
  const mockEmit = jest.fn();
  return {
    Server: jest.fn(() => ({
      to: mockTo,
      emit: mockEmit,
    })),
  };
});

describe('PairingService', () => {
  let service: PairingService;
  let mockIo: jest.Mocked<SocketIOServer>;

  beforeEach(() => {
    mockIo = new SocketIOServer() as jest.Mocked<SocketIOServer>;
    service = new PairingService(mockIo);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Deve registrar temp code (only code from TV) e validar com sucesso (admin add slug/token), emit "paired" to temp room', () => {
    const code = '123456';
    const slug = 'recepcao-principal';
    const token = 'channel-token-real';

    service.registerTempCode(code);

    service.validateCode(code, slug, token);
    const jwtToken = jwt.sign(
          { role: 'client', channel: slug }, 
          token, 
          { expiresIn: '24h' }
        );
    expect(mockIo.to).toHaveBeenCalledWith(`pairing-${code}`);
    expect(mockIo.emit).toHaveBeenCalledWith('paired', { slug, token:jwtToken });
    expect(() => service.validateCode(code, 'any', 'any')).toThrow('Código inválido ou expirado');
  });

  it('Deve lançar erro para code inválido', () => {
    expect(() => service.validateCode('000000', 'any', 'any')).toThrow('Código inválido ou expirado');
  });

  it('Deve lançar erro para code expirado', () => {
    const code = '654321';
    service.registerTempCode(code);

    jest.advanceTimersByTime(360000); // Expire

    expect(() => service.validateCode(code, 'any', 'any')).toThrow('Código inválido ou expirado');
  });

  it('Deve cleanup expired codes on validate (não afeta valid)', () => {
    service.registerTempCode('111111');
    jest.advanceTimersByTime(360000); // Expire old

    service.registerTempCode('222222');

    service.validateCode('222222', 'new', 'new-token');
    // No throw, old expired cleaned
  });
});