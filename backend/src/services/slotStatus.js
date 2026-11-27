// Shared status values for slots and bookings.

// Bookings that still hold seats (MH-01 / MH-08: a CANCELLED booking frees its seats).
export const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED'];

// MH-09: a slot replaced by a weekly copy that is still referenced by cancelled
// bookings is archived instead of deleted, so those bookings keep their history.
// Archived slots are hidden from the schedule and can never be booked (not OPEN).
export const ARCHIVED_STATUS = 'ARCHIVED';
