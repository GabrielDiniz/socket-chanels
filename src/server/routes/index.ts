// src/server/routes/index.ts
import { Router } from 'express';
import { createIngestController, authMiddleware } from '../controllers/ingest.controller';
import { channelController } from '../controllers/channel.controller';
import type { SocketService } from '../services/socket.service';

const router = Router();

export const createRoutes = (socketService: SocketService) => {
  router.post('/register', channelController);
  router.post('/chamada', authMiddleware, createIngestController(socketService));

  return router;
};