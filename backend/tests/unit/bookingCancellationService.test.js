import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findByPk: vi.fn() }));
vi.mock('../../src/db/index.js', () => ({
  sequelize: { transaction: vi.fn() },
  models: {
    Booking: { findByPk: mocks.findByPk },
    BookingTable: {}, Slot: {}, DiningTable: {}, User: {}
  }
}));
vi.mock('../../src/services/tableAvailability.js', () => ({ findFreeTables: vi.fn() }));
vi.mock('../../src/services/partySplit.js', () => ({ splitParty: vi.fn() }));

import { cancelBooking } from '../../src/services/bookingService.js';

function fixture(overrides = {}) {
  const booking = {
    id: 12, hikerId: 7, slotId: 4, numberOfPeople: 2, status: 'CONFIRMED',
    ...overrides
  };
  booking.update = vi.fn(async changes => {
    Object.assign(booking, changes);
    return booking;
  });
  return booking;
}

let booking;
beforeEach(() => {
  vi.clearAllMocks();
  booking = fixture();
  mocks.findByPk.mockResolvedValue(booking);
});

describe('MH-83 cancelBooking service', () => {
  it.each([0, -1, 1.5, NaN, '12', null])('rejects invalid booking ID %s', async bookingId => {
    await expect(cancelBooking({ bookingId })).rejects.toMatchObject({ status: 400, name: 'BookingError' });
    expect(mocks.findByPk).not.toHaveBeenCalled();
  });

  it('returns 404 when the booking does not exist', async () => {
    mocks.findByPk.mockResolvedValue(null);
    await expect(cancelBooking({ bookingId: 12 })).rejects.toMatchObject({ status: 404, message: 'Booking not found' });
  });

  it('rejects a different hiker without changing the booking', async () => {
    await expect(cancelBooking({ bookingId: 12, hikerId: 99 })).rejects.toMatchObject({ status: 403 });
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('allows cancellation by the booking owner', async () => {
    const result = await cancelBooking({ bookingId: 12, hikerId: 7 });
    expect(booking.update).toHaveBeenCalledExactlyOnceWith({ status: 'CANCELLED' });
    expect(result).toEqual({ id: 12, hikerId: 7, slotId: 4, numberOfPeople: 2, status: 'CANCELLED' });
  });

  it('allows cancellation without an ownership restriction (warden flow)', async () => {
    const result = await cancelBooking({ bookingId: 12 });
    expect(result.status).toBe('CANCELLED');
    expect(booking.update).toHaveBeenCalledOnce();
  });

  it.each(['PENDING', 'CONFIRMED'])('cancels an active %s booking', async status => {
    booking.status = status;
    const result = await cancelBooking({ bookingId: 12 });
    expect(result.status).toBe('CANCELLED');
  });

  it.each(['CANCELLED', 'COMPLETED'])('rejects an inactive %s booking', async status => {
    booking.status = status;
    await expect(cancelBooking({ bookingId: 12 })).rejects.toMatchObject({ status: 409, message: 'Booking is not active' });
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('does not update the booking when database lookup fails', async () => {
    mocks.findByPk.mockRejectedValue(new Error('database unavailable'));
    await expect(cancelBooking({ bookingId: 12 })).rejects.toThrow('database unavailable');
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('propagates database update failures', async () => {
    booking.update.mockRejectedValue(new Error('write failed'));
    await expect(cancelBooking({ bookingId: 12 })).rejects.toThrow('write failed');
  });
});
