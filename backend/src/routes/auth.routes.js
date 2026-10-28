import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';

export function createAuthRouter({ User }) {
  const router = Router();
  const { login, logout } = createAuthController({ User });

  router.post('/login', login);
  router.post('/logout', logout);

  return router;
}
