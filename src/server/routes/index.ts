// src/server/routes/index.ts
import { Router } from 'express';
import { createIngestController, authMiddleware } from '../controllers/ingest.controller';
import { channelController } from '../controllers/channel.controller';
import { getChannelHistory } from '../controllers/history.controller';
import type { SocketService } from '../services/socket.service';

const router = Router();

export const createRoutes = (socketService: SocketService) => {
  // Rotas Administrativas / Ingestão
  router.post('/register', channelController);
  router.post('/chamada', authMiddleware, createIngestController(socketService));

  // Rotas Públicas (Frontend TV)
  router.get('/channels/:slug/history', getChannelHistory);

  return router;
};