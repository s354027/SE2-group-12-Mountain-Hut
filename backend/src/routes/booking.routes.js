import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requirePasswordChanged } from '../middleware/requirePasswordChanged.js';
import { createBooking, createStaffBooking, cancelBooking, modifyBooking, getBooking, listBookings } from '../controllers/bookingController.js';

const router = Router();

/**
 * GET /api/bookings
 * List bookings owned by the authenticated hiker.
 */
router.get(
  '/',
  requireAuth,
  requireRole('HIKER'),
  listBookings
);

/**
 * GET /api/bookings/:id
 * Fetch a single booking owned by the authenticated hiker.
 */
router.get(
  '/:id',
  requireAuth,
  requireRole('HIKER'),
  getBooking
);

/**
 * POST /api/bookings
 * Create a new booking for an authenticated Hiker.
 */
router.post(
  '/',
  requireAuth,
  requireRole('HIKER'),
  requirePasswordChanged,
  createBooking
);

/**
 * POST /api/bookings/staff
 * An employee enters a reservation on behalf of a hiker (MH-07).
 */
router.post(
  '/staff',
  requireAuth,
  requireRole('EMPLOYEE'),
  createStaffBooking
);

/**
 * PATCH /api/bookings/:id
 * Modify a booking owned by the authenticated hiker.
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('HIKER'),
  requirePasswordChanged,
  modifyBooking
);

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

export default router;
