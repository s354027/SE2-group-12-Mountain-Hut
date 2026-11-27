// MH-96: GET /api/slots reports how many active bookings each slot has, so the
// weekly copy panel can flag the weeks that cannot be replaced (MH-09).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'mh-slot-booking-count-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');

const PASSWORD = 'test-password-123';
let server;
let baseUrl;
let cookie;
let bookedSlot;
let emptySlot;
let cancelledOnlySlot;
let archivedSlot;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await hashPassword(PASSWORD);
  await models.User.create({ firstName: 'E', lastName: 'M', email: 'employee.count@test.it', role: 'EMPLOYEE', passwordHash });
  const hiker = await models.User.create({ firstName: 'H', lastName: 'K', email: 'hiker.count@test.it', role: 'HIKER', passwordHash });
  const table = await models.DiningTable.create({ tableNumber: 1, seats: 4 });

  bookedSlot = await models.Slot.create({ date: '2030-07-01', startTime: '12:00', duration: 60, meal: 'LUNCH', totalCapacity: 4 });
  emptySlot = await models.Slot.create({ date: '2030-07-01', startTime: '19:00', duration: 60, meal: 'DINNER', totalCapacity: 4 });
  cancelledOnlySlot = await models.Slot.create({ date: '2030-07-02', startTime: '12:00', duration: 60, meal: 'LUNCH', totalCapacity: 4 });
  archivedSlot = await models.Slot.create({ date: '2030-07-03', startTime: '12:00', duration: 60, meal: 'LUNCH', totalCapacity: 4, status: 'ARCHIVED' });
  await bookedSlot.setTables([table]);
  await models.Booking.create({ hikerId: hiker.id, slotId: cancelledOnlySlot.id, numberOfPeople: 2, status: 'CANCELLED' });
  await models.Booking.create({ hikerId: hiker.id, slotId: bookedSlot.id, numberOfPeople: 2, status: 'CONFIRMED' });
  await models.Booking.create({ hikerId: hiker.id, slotId: bookedSlot.id, numberOfPeople: 1, status: 'CANCELLED' });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee.count@test.it', password: PASSWORD })
  });
  expect(login.status).toBe(200);
  cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  await sequelize.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

it('GET /api/slots returns the active booking count of each slot and hides archived slots', async () => {
  const response = await fetch(`${baseUrl}/api/slots`, { headers: { Cookie: cookie } });
  expect(response.status).toBe(200);

  const slots = await response.json();
  const byId = Object.fromEntries(slots.map((slot) => [slot.id, slot]));

  expect(Number(byId[bookedSlot.id].activeBookingCount)).toBe(1);
  expect(Number(byId[cancelledOnlySlot.id].activeBookingCount)).toBe(0);
  expect(Number(byId[emptySlot.id].activeBookingCount)).toBe(0);
  expect(byId[archivedSlot.id]).toBeUndefined();
  expect(byId[bookedSlot.id].tables.map((t) => t.tableNumber)).toEqual([1]);
});
