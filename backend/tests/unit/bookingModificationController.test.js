import { beforeEach, describe, expect, it, vi } from 'vitest';

const { modifyBookingForHiker } = vi.hoisted(() => ({ modifyBookingForHiker: vi.fn() }));
vi.mock('../../src/services/bookingService.js', () => {
  class BookingError extends Error {
    constructor(status, message) { super(message); this.status = status; this.name = 'BookingError'; }
  }
  return { modifyBookingForHiker, BookingError };
});
const { notifyBookingModified } = vi.hoisted(() => ({ notifyBookingModified: vi.fn() }));
vi.mock('../../src/services/bookingNotifications.js', () => ({
  notifyBookingConfirmed: vi.fn(),
  notifyBookingModified
}));

import { modifyBooking } from '../../src/controllers/bookingController.js';
import { BookingError } from '../../src/services/bookingService.js';

function response() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}
function request(id = '12', body = { numberOfPeople: 3 }) {
  return { params: { id }, body, session: { user: { id: 7 } } };
}

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('modifyBooking controller', () => {
  it.each(['0', '-2', 'abc', '1.5'])('rejects invalid booking ID %s', async id => {
    const res = response(); await modifyBooking(request(id), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(modifyBookingForHiker).not.toHaveBeenCalled();
  });
  it.each([null, [], 'hello'])('rejects malformed request body', async body => {
    const res = response(); await modifyBooking(request('12', body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(modifyBookingForHiker).not.toHaveBeenCalled();
  });
  it('rejects an empty patch', async () => {
    const res = response(); await modifyBooking(request('12', {}), res);
    expect(res.json).toHaveBeenCalledWith({ error: 'No booking fields to update' });
  });
  it('rejects unsupported fields', async () => {
    const res = response(); await modifyBooking(request('12', { status: 'CANCELLED' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(modifyBookingForHiker).not.toHaveBeenCalled();
  });
  it('passes the authenticated hiker and PATCH fields to the service', async () => {
    const result = { id: 12, numberOfPeople: 3 };
    modifyBookingForHiker.mockResolvedValue(result);
    const res = response(); await modifyBooking(request(), res);
    expect(modifyBookingForHiker).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 12, hikerId: 7, numberOfPeople: 3, slotId: undefined
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
    expect(notifyBookingModified).toHaveBeenCalledWith(result.id);
  });
  it.each([ [403, 'Cannot modify another hiker booking'], [404, 'Booking not found'], [409, 'Booking is not active'] ])('maps BookingError %i to HTTP response', async (status, message) => {
    modifyBookingForHiker.mockRejectedValue(new BookingError(status, message));
    const res = response(); await modifyBooking(request(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: message });
  });
  it('maps Sequelize validation failures to 400', async () => {
    modifyBookingForHiker.mockRejectedValue(Object.assign(new Error('invalid'), { name: 'SequelizeValidationError' }));
    const res = response(); await modifyBooking(request(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('returns 500 for unexpected errors', async () => {
    modifyBookingForHiker.mockRejectedValue(new Error('unexpected'));
    const res = response(); await modifyBooking(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to modify booking' });
  });
});
