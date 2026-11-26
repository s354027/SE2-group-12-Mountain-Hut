import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createHikeController } from '../controllers/hikeController.js';

export function createHikeRouter({ Hike, User }) {
  const router = Router();
  const { getActiveHikes } = createHikeController({ Hike, User });

  // Only staff can monitor ongoing hikes (MH-91)
  router.use(requireAuth, requireRole('EMPLOYEE', 'WARDEN'));

  router.get('/active', getActiveHikes);

  return router;
}
