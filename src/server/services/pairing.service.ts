// src/server/services/pairing.service.ts — Service para pareamento realtime backend (in memory map temp codes, register code only from TV socket, validate add slug/token + emit 'paired' to temp room, cleanup expired on validate)

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../config/logger';
import jwt from 'jsonwebtoken'; 

interface TempPairingData {
  expiresAt: number; // Unix timestamp ms
}

export class PairingService {
  private io: SocketIOServer;
  private tempCodes: Map<string, TempPairingData> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io
  }

  // Called from TV socket 'register_temp_code' (TV send only code)
  registerTempCode(code: string, expiresInSeconds = 300): void {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    this.tempCodes.set(code, { expiresAt });
    logger.info('[Pairing] Temp code registered (code only from TV)', { code });
  }

  // Called from admin validate API (add slug/token, emit 'paired', cleanup)
  validateCode(code: string, slug: string, token: string): void {
    const data = this.tempCodes.get(code);
    
    if (!data || data.expiresAt < Date.now()) {
      if (data) this.tempCodes.delete(code); // Cleanup expired
      throw new Error('Código inválido ou expirado');
    }
    const jwtToken = jwt.sign(
      { role: 'client', channel: slug }, 
      token, 
      { expiresIn: '24h' }
    );
    // Emit 'paired' to temp room
    this.io.to(`pairing-${code}`).emit('paired', { slug, token: jwtToken });

    this.tempCodes.delete(code); // Cleanup after success
    logger.info('[Pairing] Code validated and "paired" emitted (admin added slug/token)', { code, slug });
  }
}
