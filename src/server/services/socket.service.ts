import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../config/logger';


export class SocketService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupConnectionLogs();
  }

  private setupConnectionLogs() {
    this.io.on('connection', (socket) => {
      logger.debug(`[Socket] Conectado: ${socket.id}`,{socketId: socket.id});
      
      socket.on('join_channel', (channelId: string) => {
        socket.join(channelId);
        logger.debug(`[Socket] ${socket.id} Entrou na sala: ${channelId}`,{channel: channelId, socketId: socket.id});
      });
      
      socket.on('disconnect', () => {
        logger.debug(`[Socket] Desconectado: ${socket.id}`,{socketId: socket.id});
      });
    });
  }

  public broadcastCall(channel: string, data: any) {
    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      logger.warn('[Socket] Tentativa de broadcast para channel inválido', { channel });
      return;
    }
    
    // Podemos logar nível debug se quisermos ver todo tráfego, ou info apenas em eventos críticos
    logger.debug(`[Socket] Broadcasting para ${channel}`, { data });
    
    this.io.to(channel).emit('call_update', data);
    
  }
}