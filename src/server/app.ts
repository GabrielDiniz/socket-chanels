// src/server/app.ts — Factory do app (create and inject PairingService + SocketService)

import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { SocketService } from './services/socket.service';
import { PairingService } from './services/pairing.service'; // Add
import { createRoutes } from './routes';
import { logger } from './config/logger';

export async function createApp() {
  const expressApp = express();
  const httpServer = http.createServer(expressApp);

  // 1. Socket.IO Setup
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  // 2. Serviços
  const pairingService = new PairingService(io); // Create and inject io
  const socketService = new SocketService(io, pairingService); // SocketService handles register_temp_code

  // 3. Middlewares globais
  expressApp.use(express.json());

  // 4. Rotas da API — prefixo /api/v1
  const routes = createRoutes(socketService,pairingService); // No need pairingService in routes (service uses io direct)
  expressApp.use('/api/v1', routes);

  // 5. Health check — sempre disponível
  expressApp.get('/health', (_, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      clients: io.engine.clientsCount,
      mode: env.NEXT_ENABLED ? 'hybrid (Next.js + API)' : 'API Only',
    });
  });

  // 6. Redirect manual da raiz para /panel quando frontend ativo
  if (env.NEXT_ENABLED) {
    expressApp.get('/', (_, res) => {
      res.redirect(307, '/panel');
    });
  }

  // 7. Integração Next.js — pula em Jest pra evitar crashes pesados
  let nextHandler: any = null;

  if (env.NEXT_ENABLED && !process.env.JEST_WORKER_ID) {
    try {
      const dev = env.NODE_ENV === 'development';
      const next = require('next');
      const nextApp = next({
        dev,
        dir: process.cwd(),
      });

      nextHandler = nextApp.getRequestHandler();
      await nextApp.prepare();

      logger.info('Next.js preparado e integrado (App Router ativo)');
    } catch (err: any) {
      logger.error('Falha ao inicializar Next.js — caindo para modo API Only', {
        error: err.message,
      });
    }
  }

  // 8. Stubs para testes de integração (quando NEXT_ENABLED=true mas Next.js pulado)
  if (env.NEXT_ENABLED && !nextHandler) {
    expressApp.get('/panel', (_, res) => {
      res.status(200).send(`
        <html>
          <head><title>Painel de Chamada</title></head>
          <body><h1>Panel Stub - Frontend Ativo (Test Mode)</h1></body>
        </html>
      `);
    });

    expressApp.get('/admin', (_, res) => {
      res.status(200).send(`
        <html>
          <head><title>Admin</title></head>
          <body><h1>Admin Stub - Frontend Ativo (Test Mode)</h1></body>
        </html>
      `);
    });
  }

  // 9. Fallback para Next.js ou página API Only
  if (nextHandler) {
    expressApp.all('*', (req: Request, res: Response) => {
      return nextHandler(req, res);
    });
  } else if (!env.NEXT_ENABLED) {
    expressApp.get('/', (_, res) => {
      res.send(`
        <h1>Painel de Chamada — API Only</h1>
        <p>Frontend desativado (NEXT_ENABLED=false)</p>
        <p>Clientes conectados: ${io.engine.clientsCount}</p>
      `);
    });
  }

  return { expressApp, httpServer, io, socketService, pairingService }; // Return pairingService for tests
}