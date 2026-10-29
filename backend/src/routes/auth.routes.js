import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createAuthController } from '../controllers/authController.js';

export function createAuthRouter({ User }) {
  const router = Router();
  const { register, login, logout, getMe } = createAuthController({ User });

  router.post('/register', register);
  router.post('/login', login);
  router.post('/logout', logout);
  // Protected endpoint to retrieve the current session state
  router.get('/me', requireAuth, getMe);

  return router;
}