import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), findByPk: vi.fn(), findOne: vi.fn(), sum: vi.fn(),
  slotFindByPk: vi.fn(), destroy: vi.fn(), bulkCreate: vi.fn(),
  findFreeTables: vi.fn(), splitParty: vi.fn()
}));
vi.mock('../../src/db/index.js', () => ({
  sequelize: { transaction: mocks.transaction },
  models: {
    Booking: { findByPk: mocks.findByPk, findOne: mocks.findOne, sum: mocks.sum },
    BookingTable: { destroy: mocks.destroy, bulkCreate: mocks.bulkCreate },
    Slot: { findByPk: mocks.slotFindByPk }, DiningTable: {}
  }
}));
vi.mock('../../src/services/tableAvailability.js', () => ({ findFreeTables: mocks.findFreeTables }));
vi.mock('../../src/services/partySplit.js', () => ({ splitParty: mocks.splitParty }));

import { modifyBookingForHiker } from '../../src/services/bookingService.js';

const input = { bookingId: 12, hikerId: 7 };
let booking;
function bookingFixture(overrides = {}) {
  const data = {
    id: 12, hikerId: 7, slotId: 10, numberOfPeople: 2, status: 'CONFIRMED',
    allergyFlag: false, allergyDescription: null, dietaryRequirements: [],
    tables: [{ id: 1, tableNumber: 1, BookingTable: { allocatedSeats: 2 } }], ...overrides
  };
  data.update = vi.fn(async changes => { Object.assign(data, changes); return data; });
  return data;
}
function expectError(promise, status) {
  return expect(promise).rejects.toMatchObject({ name: 'BookingError', status });
}

function slotDateTimeAfter(minutes) {
  const date = new Date(Date.now() + minutes * 60 * 1000);
  const pad = value => String(value).padStart(2, '0');

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    startTime: `${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((_options, callback) => callback({}));
  booking = bookingFixture();
  mocks.findByPk.mockImplementation(async () => booking);
  mocks.findOne.mockResolvedValue(null);
  mocks.sum.mockResolvedValue(0);
  mocks.slotFindByPk.mockResolvedValue({ id: 10, date: '2099-01-01', startTime: '12:00:00', status: 'OPEN', totalCapacity: 10 });
  mocks.findFreeTables.mockResolvedValue([{ id: 1, tableNumber: 1, seats: 6 }]);
  mocks.splitParty.mockImplementation(n => [{ id: 1, tableNumber: 1, allocatedSeats: n }]);
  mocks.destroy.mockResolvedValue(1);
  mocks.bulkCreate.mockResolvedValue([]);
});

describe('modifyBookingForHiker service', () => {
  it('rejects invalid booking ID before starting a transaction', async () => {
    await expectError(modifyBookingForHiker({ ...input, bookingId: 0 }), 400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects a missing booking', async () => {
    mocks.findByPk.mockResolvedValue(null);
    await expectError(modifyBookingForHiker(input), 404);
  });
  it('rejects modification by another hiker', async () => {
    booking.hikerId = 99;
    await expectError(modifyBookingForHiker(input), 403);
    expect(booking.update).not.toHaveBeenCalled();
  });
  it('rejects cancelled bookings', async () => {
    booking.status = 'CANCELLED';
    await expectError(modifyBookingForHiker(input), 409);
  });
  it('rejects invalid party size', async () => {
    await expectError(modifyBookingForHiker({ ...input, numberOfPeople: 0 }), 400);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it('rejects invalid allergy details', async () => {
    await expectError(modifyBookingForHiker({ ...input, allergyFlag: true, allergyDescription: '' }), 400);
  });
  it('returns 404 when the booking source slot is missing', async () => {
    mocks.slotFindByPk.mockResolvedValue(null);
    await expect(modifyBookingForHiker(input)).rejects.toMatchObject({
      name: 'BookingError',
      status: 404,
      message: 'Slot not found'
    });
    expect(booking.update).not.toHaveBeenCalled();
  });
  it('updates dietary requirements without reallocating tables', async () => {
    const result = await modifyBookingForHiker({ ...input, dietaryRequirements: [{ allergies: false, description: ' Vegan ' }] });
    expect(booking.update).toHaveBeenCalledWith(expect.objectContaining({
      dietaryRequirements: [{ allergies: false, description: 'Vegan' }], numberOfPeople: 2
    }), expect.any(Object));
    expect(mocks.destroy).not.toHaveBeenCalled();
    expect(mocks.bulkCreate).not.toHaveBeenCalled();
    expect(result.tables).toEqual([{ id: 1, tableNumber: 1, allocatedSeats: 2 }]);
  });
  it('rejects unavailable target slot', async () => {
    mocks.slotFindByPk
      .mockResolvedValueOnce({ id: 10, date: '2099-01-01', startTime: '12:00:00', status: 'OPEN' })
      .mockResolvedValueOnce({ id: 11, status: 'CLOSED' });
    await expectError(modifyBookingForHiker({ ...input, slotId: 11 }), 409);
  });
  it('rejects a target slot starting less than two hours from now', async () => {
    const targetDateTime = slotDateTimeAfter(60);
    mocks.slotFindByPk
      .mockResolvedValueOnce({ id: 10, date: '2099-01-01', startTime: '12:00:00', status: 'OPEN' })
      .mockResolvedValueOnce({ id: 11, status: 'OPEN', ...targetDateTime, totalCapacity: 10 });
    await expect(modifyBookingForHiker({ ...input, slotId: 11 })).rejects.toMatchObject({
      name: 'BookingError',
      status: 409,
      message: 'Booking deadline has passed'
    });
  });
  it('rejects a target slot with an invalid start date', async () => {
    mocks.slotFindByPk
      .mockResolvedValueOnce({ id: 10, date: '2099-01-01', startTime: '12:00:00', status: 'OPEN' })
      .mockResolvedValueOnce({ id: 11, status: 'OPEN', date: 'invalid-date', startTime: '12:00:00', totalCapacity: 10 });
    await expect(modifyBookingForHiker({ ...input, slotId: 11 })).rejects.toMatchObject({
      name: 'BookingError',
      status: 409,
      message: 'Booking deadline has passed'
    });
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it('rejects another active booking for the target slot', async () => {
    mocks.findOne.mockResolvedValue({ id: 15 });
    await expectError(modifyBookingForHiker({ ...input, slotId: 11 }), 409);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it('rejects insufficient slot capacity', async () => {
    mocks.sum.mockResolvedValue(9);
    await expectError(modifyBookingForHiker({ ...input, numberOfPeople: 3 }), 409);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it('rejects missing free table allocation', async () => {
    mocks.splitParty.mockReturnValue(null);
    await expectError(modifyBookingForHiker({ ...input, numberOfPeople: 3 }), 409);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it('rejects invalid allocated seat totals', async () => {
    mocks.splitParty.mockReturnValue([{ id: 1, tableNumber: 1, allocatedSeats: 1 }]);
    await expect(modifyBookingForHiker({ ...input, numberOfPeople: 3 })).rejects.toThrow('Invalid table allocation');
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it('reallocates tables and saves new party size', async () => {
    const result = await modifyBookingForHiker({ ...input, numberOfPeople: 3 });
    expect(mocks.findFreeTables).toHaveBeenCalledWith(10, expect.objectContaining({ excludeBookingId: 12 }));
    expect(mocks.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { bookingId: 12 } }));
    expect(mocks.bulkCreate).toHaveBeenCalledWith([{ bookingId: 12, tableId: 1, allocatedSeats: 3 }], expect.objectContaining({ validate: true }));
    expect(booking.update).toHaveBeenCalledWith(expect.objectContaining({ numberOfPeople: 3 }), expect.any(Object));
    expect(result.numberOfPeople).toBe(3);
  });
  it('does not update booking if allocation insertion fails', async () => {
    mocks.bulkCreate.mockRejectedValue(new Error('database insert failed'));
    await expect(modifyBookingForHiker({ ...input, numberOfPeople: 3 })).rejects.toThrow('database insert failed');
    expect(booking.update).not.toHaveBeenCalled();
  });
});
