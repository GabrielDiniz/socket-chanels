// server.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './src/server/config/env';
import { SocketService } from './src/server/services/socket.service';
import { createRoutes } from './src/server/routes'; // ← nova importação

async function bootstrap() {
  const expressApp = express();
  const httpServer = http.createServer(expressApp);

  console.log('---------------------------------------------------');
  console.log(`Inicializando Painel de Chamada v1.0`);
  console.log(`Modo: ${env.NEXT_ENABLED ? 'FULL STACK (Frontend + API)' : 'HEADLESS (API Only)'}`);
  console.log('---------------------------------------------------');

  // 1. Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  // 2. Serviços
  const socketService = new SocketService(io);

  // 3. Middlewares globais
  expressApp.use(express.json());

  // 4. Rotas organizadas (novo padrão limpo)
  const routes = createRoutes(socketService);
  expressApp.use('/api/v1', routes);

  // 5. Healthcheck (obrigatório em produção)
  expressApp.get('/health', (_, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      clients: io.engine.clientsCount,
    });
  });

  // 6. Next.js (opcional)
  if (env.NEXT_ENABLED) {
    const next = require('next');
    const dev = env.NODE_ENV !== 'production';
    const app = next({ dev });
    const handle = app.getRequestHandler();

    await app.prepare();
    expressApp.all('*', (req, res) => handle(req, res));
    console.log('> Next.js frontend carregado');
  } else {
    expressApp.get('/', (_, res) => {
      res.send(`
        <h1>Painel de Chamada — API Only</h1>
        <p>Frontend desativado (NEXT_ENABLED=false)</p>
        <p>Clientes conectados: ${io.engine.clientsCount}</p>
      `);
    });
  }

  // 7. Inicia o servidor
  httpServer.listen(env.PORT, () => {
    console.log(`> Server rodando em http://localhost:${env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nEncerrando servidor...');
    io.close(() => {
      httpServer.close(() => {
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Falha crítica ao iniciar o servidor:', err);
  process.exit(1);
});