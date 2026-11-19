import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'mh-booking-cancellation-'));
process.env.DB_PATH = join(tempDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');

const PASSWORD = 'integration-test-password';
const FUTURE_DATE = '2090-06-15';
let server;
let baseUrl;
let owner;
let otherHiker;
let employee;
let pendingPwdHiker;
let futureSlot;
let pastSlot;
let futureTable;
let pastTable;
let booking;

function browser() {
  let cookie = '';
  return async (method, path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length) cookie = setCookies.map(c => c.split(';')[0]).join('; ');
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* ignore non-JSON */ }
    return { status: response.status, data };
  };
}

async function login(user) {
  const request = browser();
  const result = await request('POST', '/api/auth/login', {
    email: user.email,
    password: PASSWORD
  });
  expect(result.status).toBe(200);
  return request;
}

function cancel(request, hikerId = owner.id, bookingId = booking.id) {
  return request('PATCH', `/api/hikers/${hikerId}/bookings/${bookingId}/cancel`);
}

async function allocations(bookingId = booking.id) {
  const rows = await models.BookingTable.findAll({
    where: { bookingId },
    order: [['tableId', 'ASC']]
  });
  return rows.map(row => ({ tableId: row.tableId, allocatedSeats: row.allocatedSeats }));
}

async function expectUnchanged() {
  const saved = await models.Booking.findByPk(booking.id);
  expect(saved.status).toBe('CONFIRMED');
  expect(await allocations()).toEqual([{ tableId: futureTable.id, allocatedSeats: 4 }]);
}

async function createBookingRow({ hikerId, slotId, tableId, seats, status = 'CONFIRMED' }) {
  const created = await models.Booking.create({
    hikerId,
    slotId,
    numberOfPeople: seats,
    status,
    allergyFlag: false,
    allergyDescription: null,
    dietaryRequirements: []
  });
  await models.BookingTable.create({ bookingId: created.id, tableId, allocatedSeats: seats });
  return created;
}

function checkAvailability(partySize = 4) {
  return browser()('GET', `/api/availability?date=${FUTURE_DATE}&startTime=12:00&partySize=${partySize}`);
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await hashPassword(PASSWORD);
  owner = await models.User.create({ firstName: 'Owner', lastName: 'Hiker', email: 'owner-cancel@test.it', phone: '3330000001', role: 'HIKER', passwordHash });
  otherHiker = await models.User.create({ firstName: 'Other', lastName: 'Hiker', email: 'other-cancel@test.it', phone: '3330000002', role: 'HIKER', passwordHash });
  employee = await models.User.create({ firstName: 'Staff', lastName: 'Member', email: 'staff-cancel@test.it', role: 'EMPLOYEE', passwordHash });
  pendingPwdHiker = await models.User.create({ firstName: 'Pending', lastName: 'Password', email: 'pending-cancel@test.it', phone: '3330000003', role: 'HIKER', passwordHash, mustChangePassword: true });

  futureSlot = await models.Slot.create({ date: FUTURE_DATE, startTime: '12:00', duration: 90, meal: 'LUNCH', totalCapacity: 4, status: 'OPEN' });
  pastSlot = await models.Slot.create({ date: '2000-01-01', startTime: '12:00', duration: 90, meal: 'LUNCH', totalCapacity: 4, status: 'OPEN' });
  futureTable = await models.DiningTable.create({ tableNumber: 801, seats: 4 });
  pastTable = await models.DiningTable.create({ tableNumber: 802, seats: 4 });
  await models.SlotTable.bulkCreate([
    { slotId: futureSlot.id, tableId: futureTable.id },
    { slotId: pastSlot.id, tableId: pastTable.id }
  ]);

  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await models.BookingTable.destroy({ where: {} });
  await models.Booking.destroy({ where: {} });
  // The owner's booking fills the whole slot (4 seats on the only table)
  booking = await createBookingRow({ hikerId: owner.id, slotId: futureSlot.id, tableId: futureTable.id, seats: 4 });
});

afterAll(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await sequelize.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('MH-08 PATCH /api/hikers/:id/bookings/:bookingId/cancel - integration', () => {
  describe('access control', () => {
    it('rejects an unauthenticated request (401) without changing the booking', async () => {
      const result = await cancel(browser());
      expect(result.status).toBe(401);
      await expectUnchanged();
    });

    it('rejects a non-hiker role (403) without changing the booking', async () => {
      const result = await cancel(await login(employee));
      expect(result.status).toBe(403);
      await expectUnchanged();
    });

    it('rejects a hiker who still has to change the generated password (403)', async () => {
      const request = await login(pendingPwdHiker);
      const result = await cancel(request, pendingPwdHiker.id);
      expect(result.status).toBe(403);
      expect(result.data.code).toBe('PASSWORD_CHANGE_REQUIRED');
      await expectUnchanged();
    });

    it('rejects a hiker acting on another hiker path (403)', async () => {
      const result = await cancel(await login(otherHiker), owner.id);
      expect(result.status).toBe(403);
      await expectUnchanged();
    });

    it('rejects a hiker cancelling a booking owned by someone else (403)', async () => {
      const result = await cancel(await login(otherHiker), otherHiker.id);
      expect(result.status).toBe(403);
      await expectUnchanged();
    });
  });

  describe('validation', () => {
    it('rejects an invalid booking ID (400)', async () => {
      const result = await cancel(await login(owner), owner.id, 'abc');
      expect(result.status).toBe(400);
      await expectUnchanged();
    });

    it('returns 404 for a nonexistent booking', async () => {
      const result = await cancel(await login(owner), owner.id, 999999);
      expect(result.status).toBe(404);
      await expectUnchanged();
    });
  });

  describe('successful cancellation', () => {
    it('cancels a confirmed booking and persists the CANCELLED status', async () => {
      const result = await cancel(await login(owner));
      expect(result.status).toBe(200);
      expect(result.data).toEqual({
        id: booking.id,
        hikerId: owner.id,
        slotId: futureSlot.id,
        numberOfPeople: 4,
        status: 'CANCELLED'
      });
      expect((await models.Booking.findByPk(booking.id)).status).toBe('CANCELLED');
    });

    it('cancels a pending booking', async () => {
      await booking.update({ status: 'PENDING' });
      const result = await cancel(await login(owner));
      expect(result.status).toBe(200);
      expect((await models.Booking.findByPk(booking.id)).status).toBe('CANCELLED');
    });

    it('has no time constraints: a booking for a past slot can be cancelled', async () => {
      const past = await createBookingRow({ hikerId: owner.id, slotId: pastSlot.id, tableId: pastTable.id, seats: 2 });
      const result = await cancel(await login(owner), owner.id, past.id);
      expect(result.status).toBe(200);
      expect((await models.Booking.findByPk(past.id)).status).toBe('CANCELLED');
    });

    it('rejects cancelling an already cancelled booking (409)', async () => {
      const request = await login(owner);
      expect((await cancel(request)).status).toBe(200);
      const second = await cancel(request);
      expect(second.status).toBe(409);
      expect((await models.Booking.findByPk(booking.id)).status).toBe('CANCELLED');
    });
  });

  describe('places are made available to other guests', () => {
    it('frees the seats in the public availability check', async () => {
      const before = await checkAvailability();
      expect(before.status).toBe(200);
      expect(before.data.available).toBe(false);

      expect((await cancel(await login(owner))).status).toBe(200);

      const after = await checkAvailability();
      expect(after.status).toBe(200);
      expect(after.data.available).toBe(true);
      expect(after.data.breakdown).toBe('4 seats');
    });

    it('lets another hiker book the freed seats', async () => {
      const otherRequest = await login(otherHiker);
      const body = { slotId: futureSlot.id, numberOfPeople: 4 };

      const refused = await otherRequest('POST', '/api/bookings', body);
      expect(refused.status).toBe(409);

      expect((await cancel(await login(owner))).status).toBe(200);

      const accepted = await otherRequest('POST', '/api/bookings', body);
      expect(accepted.status).toBe(201);
      const created = await models.Booking.findOne({ where: { hikerId: otherHiker.id, slotId: futureSlot.id } });
      expect(created.status).toBe('CONFIRMED');
      expect(await allocations(created.id)).toEqual([{ tableId: futureTable.id, allocatedSeats: 4 }]);
    });

    it('lets the same hiker book the slot again after cancelling', async () => {
      const request = await login(owner);
      expect((await cancel(request)).status).toBe(200);
      const result = await request('POST', '/api/bookings', { slotId: futureSlot.id, numberOfPeople: 2 });
      expect(result.status).toBe(201);
      const active = await models.Booking.findAll({ where: { hikerId: owner.id, slotId: futureSlot.id, status: 'CONFIRMED' } });
      expect(active).toHaveLength(1);
    });

    it('shows the cancelled booking in the hiker bookings list', async () => {
      const request = await login(owner);
      expect((await cancel(request)).status).toBe(200);
      const result = await request('GET', `/api/hikers/${owner.id}/bookings`);
      expect(result.status).toBe(200);
      const listed = result.data.find(item => item.id === booking.id);
      expect(listed.status).toBe('CANCELLED');
    });

    it('does not affect other bookings in the same slot', async () => {
      await models.BookingTable.destroy({ where: {} });
      await models.Booking.destroy({ where: {} });
      booking = await createBookingRow({ hikerId: owner.id, slotId: futureSlot.id, tableId: futureTable.id, seats: 2 });
      const other = await createBookingRow({ hikerId: otherHiker.id, slotId: futureSlot.id, tableId: futureTable.id, seats: 2 });

      expect((await cancel(await login(owner))).status).toBe(200);

      expect((await models.Booking.findByPk(other.id)).status).toBe('CONFIRMED');
      expect(await allocations(other.id)).toEqual([{ tableId: futureTable.id, allocatedSeats: 2 }]);
      const availability = await checkAvailability(2);
      expect(availability.data.available).toBe(true);
      expect((await checkAvailability(3)).data.available).toBe(false);
    });
  });
});
