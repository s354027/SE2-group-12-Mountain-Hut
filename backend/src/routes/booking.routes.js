import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { createBooking, cancelBooking } from '../controllers/bookingController.js';

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

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel an active booking.
 */
router.patch(
  '/:id/cancel',
  requireAuth,
  requireRole('WARDEN'), // maybe an EMPLOYEE could do this too (but the user story doesn't specify it)
  cancelBooking
);