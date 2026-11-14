import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createHikerController } from '../controllers/hikerController.js';

export function createHikerRouter({ User, sequelize }) {
  const router = Router();
  const { searchHikers } = createHikerController({ User, sequelize });

  // GET /api/hikers/search?q=... - match a hiker by name, phone or email (MH-07)
  router.get('/search', requireAuth, requireRole('EMPLOYEE'), searchHikers);

  return router;
}
