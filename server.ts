import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './src/server/config/env';
import { SocketService } from './src/server/services/socket.service';
import { createIngestController, authMiddleware } from './src/server/controllers/ingest.controller';

// Bootstrapping assíncrono para controle total
async function bootstrap() {
  const expressApp = express();
  const httpServer = http.createServer(expressApp);

  console.log('---------------------------------------------------');
  console.log(`🚀 Inicializando Painel de Chamada v1.0`);
  console.log(`🔧 Modo: ${env.NEXT_ENABLED ? 'FULL STACK (Frontend + API)' : 'HEADLESS (API Only)'}`);
  console.log('---------------------------------------------------');
  
  // 1. Configuração do Socket.io (Camada de Infraestrutura)
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ["GET", "POST"] }
  });

  // 2. Inicialização de Serviços
  const socketService = new SocketService(io);
  const ingestController = createIngestController(socketService);

  // 3. Middlewares Globais
  expressApp.use(express.json());

  // 4. Rotas da API (Backend Puro)
  expressApp.post(
    '/api/v1/chamada', 
    authMiddleware, 
    ingestController
  );

  // Endpoint de Healthcheck para Docker/K8s
  expressApp.get('/health', (_, res) => res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount 
  }));

  // 5. Integração com Next.js (Condicional e Lazy Loading)
  if (env.NEXT_ENABLED) {
    const next = require('next');
    const dev = env.NODE_ENV !== 'production';
    const app = next({ dev });
    const handle = app.getRequestHandler();

    try {
      await app.prepare();
      expressApp.all('*', (req, res) => handle(req, res));
      console.log('> ✅ Next.js frontend anexado com sucesso.');
    } catch (err) {
      console.error('> ❌ Falha crítica ao iniciar Next.js:', err);
      process.exit(1);
    }
  } else {
    // Rota padrão para quando não houver frontend
    expressApp.get('/', (_, res) => {
      res.status(200).send(`
        <div style="font-family: monospace; padding: 2rem;">
          <h1 style="color: #2563eb;">Painel Backend (API Only)</h1>
          <p>Frontend desativado via variável de ambiente.</p>
          <hr/>
          <p><strong>Status:</strong> Online 🟢</p>
          <p><strong>WebSocket:</strong> Porta ${env.PORT}</p>
          <p><strong>Clientes Conectados:</strong> ${io.engine.clientsCount}</p>
        </div>
      `);
    });
  }

  // 6. Inicialização do Servidor HTTP
  const server = httpServer.listen(env.PORT, (err?: any) => {
    if (err) throw err;
    console.log(`> 📡 Server ouvindo em http://localhost:${env.PORT}`);
  });

  // Graceful Shutdown
  const gracefulShutdown = (signal: string) => {
    console.log(`\n[${signal}] Recebido. Encerrando processos...`);
    server.close(() => {
      io.close(() => {
        console.log('  ✅ Conexões encerradas com sucesso.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();