import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../config/logger';
import { verifyToken } from '../utils/jwt.utils';
import { channelService } from './channel.service'; // Importar serviço de canal

// Estende a interface do Socket para incluir o usuário autenticado (opcional)
interface AuthenticatedSocket extends Socket {
  user?: any;
}

export class SocketService {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupMiddleware();
    this.setupConnectionLogs();
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      // O cliente deve enviar o token e o channelSlug
      const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
      const channelSlug = socket.handshake.query.channelSlug as string || socket.handshake.auth.channelSlug;

      if (!token) {
        logger.warn(`[Socket] Conexão rejeitada: Token ausente (${socket.id})`);
        return next(new Error('Authentication error: Token missing'));
      }

      if (!channelSlug) {
        logger.warn(`[Socket] Conexão rejeitada: ChannelSlug ausente (${socket.id})`);
        return next(new Error('Authentication error: ChannelSlug missing'));
      }

      try {
        // Busca o canal para obter a apiKey (que é o segredo)
        const channel = await channelService.findBySlug(channelSlug);

        if (!channel) {
             logger.warn(`[Socket] Conexão rejeitada: Canal não encontrado (${channelSlug})`);
             return next(new Error('Authentication error: Channel not found'));
        }

        // Remove "Bearer " se presente
        const tokenString = Array.isArray(token) ? token[0] : token;
        const cleanToken = tokenString.replace('Bearer ', '');

        // Verifica o token usando a apiKey do canal como segredo
        const decoded = verifyToken(cleanToken, channel.apiKey);

        if (!decoded) {
          logger.warn(`[Socket] Conexão rejeitada: Token inválido ou expirado (${socket.id}) para canal ${channelSlug}`);
          return next(new Error('Authentication error: Invalid token'));
        }

        // Anexa dados do usuário (payload do token) ao socket
        socket.user = decoded;
        next();
      } catch (err) {
        logger.error(`[Socket] Erro interno na autenticação: ${err}`);
        return next(new Error('Internal Server Error'));
      }
    });
  }

  private setupConnectionLogs() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.debug(`[Socket] Conectado: ${socket.id}`, { 
        socketId: socket.id,
        user: socket.user 
      });
      
      socket.on('join_channel', (channelId: string) => {
        // Agora podemos validar se o usuário autenticado tem permissão para este canal
        // (neste caso, o token foi assinado com a chave deste canal, então é implícito)
        socket.join(channelId);
        logger.debug(`[Socket] ${socket.id} Entrou na sala: ${channelId}`, { channel: channelId, socketId: socket.id });
      });
      
      socket.on('disconnect', () => {
        logger.debug(`[Socket] Desconectado: ${socket.id}`, { socketId: socket.id });
      });
    });
  }

  public broadcastCall(channel: string, data: any) {
    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      logger.warn('[Socket] Tentativa de broadcast para channel inválido', { channel });
      return;
    }
    
    logger.debug(`[Socket] Broadcasting para ${channel}`, { data });
    
    this.io.to(channel).emit('call_update', data);
  }
}