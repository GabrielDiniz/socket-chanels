import { Router } from 'express';
import { createIngestController, authMiddleware } from '../controllers/ingest.controller';
import { channelController } from '../controllers/channel.controller';
import { getChannelHistory } from '../controllers/history.controller';
import { createPairingController } from '../controllers/pairing.controller';
import { adminRoutes } from './admin.routes';
import { tenantRoutes } from './tenant.routes';
import { adminAuthMiddleware } from '../middlewares/admin.auth';
import { SocketService } from '../services/socket.service';
import { PairingService } from '../services/pairing.service';

const router = Router();

export const createRoutes = (socketService: SocketService, pairingService: PairingService  ) => {
  // Rotas de Admin (Backoffice)
  router.use('/admin', adminRoutes);

  // Rotas de Tenant (Gestão de Canais)
  router.use('/tenant', tenantRoutes);

  // Rota Legada/Pública de Registro
  router.post('/register', (req, res) => channelController.create(req, res));
  
  // Ingestão
  router.post('/chamada', authMiddleware, createIngestController(socketService));

  // Rotas Públicas (Histórico para TV)
  router.get('/channels/:slug/history', getChannelHistory);

  // New: Admin pairing validate
  router.post('/admin/pairing/validate', adminAuthMiddleware, createPairingController(pairingService));

  return router;
}