import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getMe } from '../controllers/authController.js';

const router = Router();

// Protected endpoint to retrieve the current session state
router.get('/me', requireAuth, getMe);

export default router;