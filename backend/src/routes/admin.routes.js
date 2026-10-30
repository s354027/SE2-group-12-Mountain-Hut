import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createAdminController } from '../controllers/adminController.js';

export function createAdminRouter({ User }) {
  const router = Router();
  const { createStaffUser } = createAdminController({ User });

  router.post('/staff', requireAuth, requireRole('WARDEN'), createStaffUser);

  return router;
}