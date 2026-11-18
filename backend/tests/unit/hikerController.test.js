import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getHikerBookingsService } = vi.hoisted(() => ({
  getHikerBookingsService: vi.fn()
}));

vi.mock('../../src/services/bookingService.js', () => {
  class BookingError extends Error {
    constructor(status, message) {
      super(message);
      this.name = 'BookingError';
      this.status = status;
    }
  }

  return {
    BookingError,
    getHikerBookings: getHikerBookingsService
  };
});

import { createHikerController } from '../../src/controllers/hikerController.js';
import { BookingError } from '../../src/services/bookingService.js';

function createResponse() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createController() {
  return createHikerController({ User: {}, sequelize: {} }).getHikerBookings;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getHikerBookings controller', () => {
  it('returns all bookings by default', async () => {
    const bookings = [{ id: 21, slotId: 6 }];
    getHikerBookingsService.mockResolvedValue(bookings);
    const res = createResponse();

    await createController()({ params: { id: '7' }, query: {} }, res);

    expect(getHikerBookingsService).toHaveBeenCalledWith(7, { upcomingOnly: false });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(bookings);
  });

  it('enables the future-slot filter when upcoming=true is requested', async () => {
    getHikerBookingsService.mockResolvedValue([]);
    const res = createResponse();

    await createController()({ params: { id: '7' }, query: { upcoming: 'true' } }, res);

    expect(getHikerBookingsService).toHaveBeenCalledWith(7, { upcomingOnly: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid upcoming query values', async () => {
    const res = createResponse();

    await createController()({ params: { id: '7' }, query: { upcoming: 'yes' } }, res);

    expect(getHikerBookingsService).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'upcoming must be true or false' });
  });

  it('maps BookingError to its HTTP status and message', async () => {
    getHikerBookingsService.mockRejectedValue(new BookingError(404, 'Hiker not found'));
    const res = createResponse();

    await createController()({ params: { id: '7' }, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Hiker not found' });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('logs unexpected errors and returns 500', async () => {
    const error = new Error('database unavailable');
    getHikerBookingsService.mockRejectedValue(error);
    const res = createResponse();

    await createController()({ params: { id: '7' }, query: {} }, res);

    expect(console.error).toHaveBeenCalledWith('Hiker booking retrieval failed:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to retrieve hiker bookings' });
  });
});
