// src/server/routes/index.ts
import { Router } from 'express';
import { createIngestController, authMiddleware } from '../controllers/ingest.controller';
import { channelController } from '../controllers/channel.controller';
import { getChannelHistory } from '../controllers/history.controller';
import type { SocketService } from '../services/socket.service';
import { adminRoutes } from './admin.routes';
import { tenantRoutes } from './tenant.routes';

const router = Router();

export const createRoutes = (socketService: SocketService) => {
  // Rotas de Admin (Backoffice)
  router.use('/admin', adminRoutes);

  // Rotas de Tenant (Gestão de Canais)
  router.use('/tenant', tenantRoutes);

  // Rota Legada/Pública de Registro
  // FIX: Apontando para o método create, não para a instância inteira
  router.post('/register', (req, res) => channelController.create(req, res));
  
  // Ingestão
  router.post('/chamada', authMiddleware, createIngestController(socketService));

  // Rotas Públicas (Histórico para TV)
  router.get('/channels/:slug/history', getChannelHistory);

  return router;
};