import { Router } from 'express';
import { tenantAuthMiddleware } from '../middlewares/tenant.auth';
// Importa o controller unificado
import { channelController } from '../controllers/channel.controller';

const router = Router();

// Protege todas as rotas com autenticação de tenant
router.use(tenantAuthMiddleware);

// Usa os métodos do controller refatorado
router.get('/channels', channelController.list);
router.post('/channels', channelController.create);
router.patch('/channels/:slug', channelController.update);
router.delete('/channels/:slug', channelController.delete);

export { router as tenantRoutes };