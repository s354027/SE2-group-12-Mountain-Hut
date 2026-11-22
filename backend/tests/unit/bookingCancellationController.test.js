import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cancelBooking: vi.fn() }));
vi.mock('../../src/services/bookingService.js', () => {
  class BookingError extends Error {
    constructor(status, message) { super(message); this.status = status; this.name = 'BookingError'; }
  }
  return { cancelBooking: mocks.cancelBooking, createBookingForHiker: vi.fn(), createBookingByStaff: vi.fn(), modifyBookingForHiker: vi.fn(), BookingError };
});
vi.mock('../../src/services/bookingNotifications.js', () => ({
  notifyBookingConfirmed: vi.fn(), notifyBookingModified: vi.fn()
}));

import { cancelBooking } from '../../src/controllers/bookingController.js';
import { BookingError } from '../../src/services/bookingService.js';

function response() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}
function request(id = '12', role = 'WARDEN', userId = 7) {
  return { params: { id }, session: { user: { id: userId, role } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('MH-83 cancelBooking controller', () => {
  it.each(['0', '-2', 'abc', '1.5', ''])('rejects invalid booking ID %s', async id => {
    const res = response();
    await cancelBooking(request(id), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bookingId must be a positive integer' });
    expect(mocks.cancelBooking).not.toHaveBeenCalled();
  });

  it('passes the booking ID to the service for a warden', async () => {
    const booking = { id: 12, status: 'CANCELLED' };
    mocks.cancelBooking.mockResolvedValue(booking);
    const res = response();
    await cancelBooking(request(), res);
    expect(mocks.cancelBooking).toHaveBeenCalledWith({ bookingId: 12, hikerId: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(booking);
  });

  it('passes hiker ownership ID when called with a hiker session', async () => {
    mocks.cancelBooking.mockResolvedValue({ id: 12, status: 'CANCELLED' });
    const res = response();
    await cancelBooking(request('12', 'HIKER', 7), res);
    expect(mocks.cancelBooking).toHaveBeenCalledWith({ bookingId: 12, hikerId: 7 });
  });

  it.each([
    [400, 'Invalid booking ID'],
    [403, 'Cannot cancel another hiker booking'],
    [404, 'Booking not found'],
    [409, 'Booking is not active']
  ])('maps BookingError %i to the response', async (status, message) => {
    mocks.cancelBooking.mockRejectedValue(new BookingError(status, message));
    const res = response();
    await cancelBooking(request(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: message });
  });

  it('returns 500 for unexpected errors without exposing internal details', async () => {
    mocks.cancelBooking.mockRejectedValue(new Error('database details'));
    const res = response();
    await cancelBooking(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to cancel booking' });
  });
});
