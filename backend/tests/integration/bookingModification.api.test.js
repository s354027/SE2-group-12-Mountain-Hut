import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'mh-booking-modification-'));
process.env.DB_PATH = join(tempDir, 'test.sqlite');


const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');

const PASSWORD = 'integration-test-password';
let server;
let baseUrl;
let owner;
let otherHiker;
let employee;
let firstSlot;
let secondSlot;
let firstTable;
let secondTable;
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

async function allocations(bookingId = booking.id) {
  const rows = await models.BookingTable.findAll({
    where: { bookingId },
    order: [['tableId', 'ASC']]
  });
  return rows.map(row => ({ tableId: row.tableId, allocatedSeats: row.allocatedSeats }));
}

async function unchangedAfter(request, body, expectedStatus, id = booking.id) {
  const before = (await models.Booking.findByPk(booking.id)).toJSON();
  const beforeAllocations = await allocations();
  const result = await request('PATCH', `/api/bookings/${id}`, body);
  expect(result.status).toBe(expectedStatus);
  expect((await models.Booking.findByPk(booking.id)).toJSON()).toEqual(before);
  expect(await allocations()).toEqual(beforeAllocations);
  return result;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await hashPassword(PASSWORD);
  owner = await models.User.create({ firstName: 'Owner', lastName: 'Hiker', email: 'owner-mod@test.it', role: 'HIKER', passwordHash });
  otherHiker = await models.User.create({ firstName: 'Other', lastName: 'Hiker', email: 'other-mod@test.it', role: 'HIKER', passwordHash });
  employee = await models.User.create({ firstName: 'Staff', lastName: 'Member', email: 'staff-mod@test.it', role: 'EMPLOYEE', passwordHash });

  
  firstSlot = await models.Slot.create({ date: '2090-06-15', startTime: '12:00', duration: 90, meal: 'LUNCH', totalCapacity: 4, status: 'OPEN' });
  secondSlot = await models.Slot.create({ date: '2090-06-16', startTime: '12:00', duration: 90, meal: 'LUNCH', totalCapacity: 4, status: 'OPEN' });
  firstTable = await models.DiningTable.create({ tableNumber: 901, seats: 4 });
  secondTable = await models.DiningTable.create({ tableNumber: 902, seats: 4 });
  await models.SlotTable.bulkCreate([
    { slotId: firstSlot.id, tableId: firstTable.id },
    { slotId: secondSlot.id, tableId: secondTable.id }
  ]);

  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await models.BookingTable.destroy({ where: {} });
  await models.Booking.destroy({ where: {} });
  booking = await models.Booking.create({
    hikerId: owner.id,
    slotId: firstSlot.id,
    numberOfPeople: 2,
    status: 'CONFIRMED',
    allergyFlag: false,
    allergyDescription: null,
    dietaryRequirements: []
  });
  await models.BookingTable.create({ bookingId: booking.id, tableId: firstTable.id, allocatedSeats: 2 });
});

afterAll(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await sequelize.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('MH-80 PATCH /api/bookings/:id - integration', () => {
  it('rejects an unauthenticated request (401) without changing the booking', async () => {
    await unchangedAfter(browser(), { numberOfPeople: 3 }, 401);
  });

  it('rejects a non-hiker role (403) without changing the booking', async () => {
    await unchangedAfter(await login(employee), { numberOfPeople: 3 }, 403);
  });

  it('rejects modification by a different hiker (403)', async () => {
    await unchangedAfter(await login(otherHiker), { numberOfPeople: 3 }, 403);
  });

  it('rejects invalid booking IDs (400)', async () => {
    await unchangedAfter(await login(owner), { numberOfPeople: 3 }, 400, 'invalid');
  });

  it('returns 404 for a nonexistent booking', async () => {
    await unchangedAfter(await login(owner), { numberOfPeople: 3 }, 404, 999999);
  });

  it('rejects an empty patch (400) and keeps the database unchanged', async () => {
    await unchangedAfter(await login(owner), {}, 400);
  });

  it('rejects unsupported fields (400) and keeps the database unchanged', async () => {
    await unchangedAfter(await login(owner), { status: 'CANCELLED' }, 400);
  });

  it('updates dietary requirements without changing the existing table allocation', async () => {
    const request = await login(owner);
    const originalAllocations = await allocations();
    const result = await request('PATCH', `/api/bookings/${booking.id}`, {
      dietaryRequirements: [{ allergies: false, description: '  1 vegetarian  ' }]
    });
    expect(result.status).toBe(200);
    expect(result.data.dietaryRequirements).toEqual([{ allergies: false, description: '1 vegetarian' }]);
    const saved = await models.Booking.findByPk(booking.id);
    expect(saved.dietaryRequirements).toEqual([{ allergies: false, description: '1 vegetarian' }]);
    expect(saved.numberOfPeople).toBe(2);
    expect(await allocations()).toEqual(originalAllocations);
  });

  it('changes party size and persists the new allocated seats', async () => {
    const request = await login(owner);
    const result = await request('PATCH', `/api/bookings/${booking.id}`, { numberOfPeople: 3 });
    expect(result.status).toBe(200);
    expect(result.data.numberOfPeople).toBe(3);
    expect((await models.Booking.findByPk(booking.id)).numberOfPeople).toBe(3);
    expect((await allocations()).reduce((sum, row) => sum + row.allocatedSeats, 0)).toBe(3);
  });

  it('moves a booking to a different slot and persists its new table assignment', async () => {
    const request = await login(owner);
    const result = await request('PATCH', `/api/bookings/${booking.id}`, { slotId: secondSlot.id });
    expect(result.status).toBe(200);
    expect(result.data.slotId).toBe(secondSlot.id);
    expect((await models.Booking.findByPk(booking.id)).slotId).toBe(secondSlot.id);
    expect(await allocations()).toEqual([{ tableId: secondTable.id, allocatedSeats: 2 }]);
  });

  it('rejects an invalid party size and preserves the previous booking and allocation', async () => {
    await unchangedAfter(await login(owner), { numberOfPeople: 0 }, 400);
  });

  it('rejects an inactive booking (409) and preserves its allocation', async () => {
    await booking.update({ status: 'CANCELLED' });
    await unchangedAfter(await login(owner), { numberOfPeople: 3 }, 409);
  });

  it('rejects insufficient slot capacity (409) without losing the old assignment', async () => {
    await unchangedAfter(await login(owner), { numberOfPeople: 5 }, 409);
  });

  it('rejects a move into a slot already booked by the same hiker (409)', async () => {
    const existing = await models.Booking.create({
      hikerId: owner.id, slotId: secondSlot.id, numberOfPeople: 1,
      status: 'CONFIRMED', allergyFlag: false, dietaryRequirements: []
    });
    await models.BookingTable.create({ bookingId: existing.id, tableId: secondTable.id, allocatedSeats: 1 });
    await unchangedAfter(await login(owner), { slotId: secondSlot.id }, 409);
    expect((await models.Booking.findByPk(existing.id)).slotId).toBe(secondSlot.id);
  });

  it('rejects a move into a full target slot (409), preserving both bookings', async () => {
    const other = await models.Booking.create({
      hikerId: otherHiker.id, slotId: secondSlot.id, numberOfPeople: 4,
      status: 'CONFIRMED', allergyFlag: false, dietaryRequirements: []
    });
    await models.BookingTable.create({ bookingId: other.id, tableId: secondTable.id, allocatedSeats: 4 });
    await unchangedAfter(await login(owner), { slotId: secondSlot.id }, 409);
    expect((await models.Booking.findByPk(other.id)).numberOfPeople).toBe(4);
    expect(await allocations(other.id)).toEqual([{ tableId: secondTable.id, allocatedSeats: 4 }]);
  });
});
