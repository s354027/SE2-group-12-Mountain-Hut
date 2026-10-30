import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createBooking } from '../controllers/bookingController.js';

const router = Router();

/**
 * POST /api/bookings
 * Create a new booking for an authenticated Hiker.
 */
router.post(
  '/',
  requireAuth,
  requireRole('HIKER'),
  createBooking
);

export default router;