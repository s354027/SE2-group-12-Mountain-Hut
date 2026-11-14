import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { createAuthController } from '../controllers/authController.js';

export function createAuthRouter({ User, PasswordResetToken }) {
  const router = Router();
  const { register, login, logout, getMe, changePassword, forgotPassword, resetPassword } =
    createAuthController({ User, PasswordResetToken });

  router.post('/register', register);
  router.post('/login', login);
  router.post('/logout', logout);
  // Protected endpoint to retrieve the current session state
  router.get('/me', requireAuth, getMe);
  // Password management (MH-07)
  router.post('/change-password', requireAuth, changePassword);
  router.post('/forgot-password', forgotPassword);
  router.post('/reset-password', resetPassword);

  return router;
}