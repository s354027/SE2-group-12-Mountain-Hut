import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requirePasswordChanged } from '../middleware/requirePasswordChanged.js';
import { createHikeController } from '../controllers/hikeController.js';

export function createHikeRouter({ Hike, User }) {
  const router = Router();
  const { getActiveHikes, createHike, getMyHikes, closeHike } = createHikeController({ Hike, User });

  // Every hike route requires a logged-in user; the role checks below
  // narrow down which role can reach each one.
  router.use(requireAuth);

  /**
   * GET /api/hikes/active
   * Ongoing hikes, for staff monitoring (MH-91/MH-122).
   */
  router.get('/active', requireRole('EMPLOYEE', 'WARDEN'), getActiveHikes);

  /**
   * GET /api/hikes/mine
   * Hikes registered by the authenticated hiker (MH-107).
   */
  router.get('/mine', requireRole('HIKER'), requirePasswordChanged, getMyHikes);

  /**
   * POST /api/hikes
   * Register a new hike for the authenticated hiker (MH-107).
   */
  router.post('/', requireRole('HIKER'), requirePasswordChanged, createHike);

  /**
   * PATCH /api/hikes/:id/close
   * Mark one of the authenticated hiker's own hikes as safely completed
   * (MH-108/MH-22).
   */
  router.patch('/:id/close', requireRole('HIKER'), requirePasswordChanged, closeHike);

  return router;
}
