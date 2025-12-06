import { Server as SocketIOServer } from 'socket.io';


export class SocketService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupConnectionLogs();
  }

  private setupConnectionLogs() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket] Conectado: ${socket.id}`);
      
      socket.on('join_channel', (channelId: string) => {
        socket.join(channelId);
        console.log(`[Socket] ${socket.id} entrou em: ${channelId}`);
      });
      
      socket.on('disconnect', () => console.log(`[Socket] Desconectado: ${socket.id}`));
    });
  }

  public broadcastCall(channel: string, data: any) {
    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      console.warn('[Socket] Tentativa de broadcast para channel inválido:', channel);
      return;
    }
    this.io.to(channel).emit('call_update', data);
    
  }
}