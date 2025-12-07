import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { SocketService } from './services/socket.service';
import { createRoutes } from './routes';

export async function createApp() {
  const expressApp = express();
  const httpServer = http.createServer(expressApp);

  // 1. Socket.IO Setup
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  // 2. Serviços
  const socketService = new SocketService(io);

  // 3. Middlewares globais
  expressApp.use(express.json());

  // 4. Rotas
  const routes = createRoutes(socketService);
  expressApp.use('/api/v1', routes);

  // 5. Healthcheck (Útil para testes de disponibilidade)
  expressApp.get('/health', (_, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      clients: io.engine.clientsCount,
    });
  });

  // 6. Rota Raiz (API Only Mode)
  expressApp.get('/', (_, res) => {
    res.send(`
      <h1>Painel de Chamada — API Only</h1>
      <p>Frontend desativado (NEXT_ENABLED=false)</p>
      <p>Clientes conectados: ${io.engine.clientsCount}</p>
    `);
  });

  // Retornamos as instâncias sem dar .listen(), permitindo que quem chamou decida
  // (seja o server.ts real ou o ambiente de testes com supertest)
  return { expressApp, httpServer, io };
}