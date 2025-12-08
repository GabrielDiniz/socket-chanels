import { Router } from 'express';
import { adminAuthMiddleware } from '../middlewares/admin.auth';
import { adminTenantController } from '../controllers/admin-tenant.controller';

const router = Router();

// Todas as rotas abaixo são protegidas pela chave de sistema
router.use(adminAuthMiddleware);

router.post('/tenants', adminTenantController.create);
router.get('/tenants', adminTenantController.list);
router.post('/tenants/:id/rotate-key', adminTenantController.rotateKey);

export { router as adminRoutes };