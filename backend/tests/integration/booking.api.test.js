
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'mh-booking-api-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');

const PASSWORD = 'test-password-123';
const HIKER = {
  firstName: 'Test',
  lastName: 'Hiker',
  email: 'booking.integration@test.it',
  role: 'HIKER'
};

const OTHER_HIKER = {
  firstName: 'Other',
  lastName: 'Hiker',
  email: 'booking.integration.other@test.it',
  role: 'HIKER'
};

let server;
let baseUrl;
let hiker;
let otherHiker;
let slot;
let table;
let getSlot;
let getTable;
let forbiddenSlot;
let forbiddenTable;
let multiTableSlot;
let multiTableA;
let multiTableB;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  hiker = await models.User.create({
    ...HIKER,
    passwordHash: await hashPassword(PASSWORD)
  });

  otherHiker = await models.User.create({
    ...OTHER_HIKER,
    passwordHash: await hashPassword(PASSWORD)
  });

  slot = await models.Slot.create({
    date: '2030-06-15',
    startTime: '19:00',
    duration: 90,
    meal: 'DINNER',
    totalCapacity: 4,
    status: 'OPEN'
  });

  table = await models.DiningTable.create({
    tableNumber: 1,
    seats: 4
  });

  await models.SlotTable.create({
    slotId: slot.id,
    tableId: table.id
  });

  // A dedicated slot/table for the GET tests, so creating bookings there
  // never collides with the booking already created in the POST tests.
  getSlot = await models.Slot.create({
    date: '2030-07-01',
    startTime: '19:00',
    duration: 90,
    meal: 'DINNER',
    totalCapacity: 4,
    status: 'OPEN'
  });

  getTable = await models.DiningTable.create({
    tableNumber: 2,
    seats: 4
  });

  await models.SlotTable.create({
    slotId: getSlot.id,
    tableId: getTable.id
  });

  // A third slot/table, dedicated to the "another hiker cannot view this
  // booking" test, so it doesn't collide with the hiker's booking on getSlot.
  forbiddenSlot = await models.Slot.create({
    date: '2030-07-02',
    startTime: '19:00',
    duration: 90,
    meal: 'DINNER',
    totalCapacity: 4,
    status: 'OPEN'
  });

  forbiddenTable = await models.DiningTable.create({
    tableNumber: 3,
    seats: 4
  });

  await models.SlotTable.create({
    slotId: forbiddenSlot.id,
    tableId: forbiddenTable.id
  });

  // A slot with two small tables, so a single booking forces a split across
  // both: verifies the GET endpoints don't duplicate the booking when eager
  // loading a belongsToMany (tables) alongside the slot include.
  multiTableSlot = await models.Slot.create({
    date: '2030-07-03',
    startTime: '19:00',
    duration: 90,
    meal: 'DINNER',
    totalCapacity: 4,
    status: 'OPEN'
  });

  multiTableA = await models.DiningTable.create({ tableNumber: 4, seats: 2 });
  multiTableB = await models.DiningTable.create({ tableNumber: 5, seats: 2 });

  await models.SlotTable.create({ slotId: multiTableSlot.id, tableId: multiTableA.id });
  await models.SlotTable.create({ slotId: multiTableSlot.id, tableId: multiTableB.id });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await sequelize.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

// Keep the session cookie between requests, just like a browser.
function createBrowser() {
  let cookie = '';

  return async function request(method, path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const setCookies = response.headers.getSetCookie();
    if (setCookies.length) {
      cookie = setCookies.map((value) => value.split(';')[0]).join('; ');
    }

    const responseText = await response.text();
    let data = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Keep non-JSON responses as null.
    }

    return { status: response.status, data };
  };
}

async function loginAsHiker() {
  const browser = createBrowser();
  const response = await browser('POST', '/api/auth/login', {
    email: HIKER.email,
    password: PASSWORD
  });

  expect(response.status).toBe(200);
  expect(response.data.role).toBe('HIKER');
  return browser;
}

async function loginAsOtherHiker() {
  const browser = createBrowser();
  const response = await browser('POST', '/api/auth/login', {
    email: OTHER_HIKER.email,
    password: PASSWORD
  });

  expect(response.status).toBe(200);
  expect(response.data.role).toBe('HIKER');
  return browser;
}

describe('POST /api/bookings', () => {
  it('requires an authenticated hiker', async () => {
    const response = await createBrowser()('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2
    });

    expect(response.status).toBe(401);
    expect(await models.Booking.count()).toBe(0);
  });

  it('creates a booking through the API and persists it with its table allocation', async () => {
    const browser = await loginAsHiker();

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: 'Peanuts'
    });

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      hikerId: hiker.id,
      slotId: slot.id,
      numberOfPeople: 2,
      status: 'CONFIRMED',
      tables: [
        {
          id: table.id,
          tableNumber: table.tableNumber,
          allocatedSeats: 2
        }
      ]
    });
    expect(response.data.id).toEqual(expect.any(Number));

    // Read from the database independently of the HTTP response.
    const savedBooking = await models.Booking.findByPk(response.data.id);
    expect(savedBooking).not.toBeNull();
    expect(savedBooking.toJSON()).toMatchObject({
      id: response.data.id,
      hikerId: hiker.id,
      slotId: slot.id,
      numberOfPeople: 2,
      status: 'CONFIRMED',
      allergyFlag: true,
      allergyDescription: 'Peanuts'
    });

    const savedAllocation = await models.BookingTable.findOne({
      where: {
        bookingId: savedBooking.id,
        tableId: table.id
      }
    });
    expect(savedAllocation).not.toBeNull();
    expect(savedAllocation.allocatedSeats).toBe(2);
  });

  it('rejects an invalid party size without writing to the database', async () => {
  const browser = await loginAsHiker();

  const bookingsBefore = await models.Booking.count();
  const allocationsBefore = await models.BookingTable.count();

  const response = await browser('POST', '/api/bookings', {
    slotId: slot.id,
    numberOfPeople: 0
  });

  expect(response.status).toBe(400);
  expect(response.data).toMatchObject({
    error: 'numberOfPeople must be a positive integer'
  });

  // Verify that the invalid request created nothing.
  expect(await models.Booking.count()).toBe(bookingsBefore);
  expect(await models.BookingTable.count()).toBe(allocationsBefore);
});
});

describe('GET /api/bookings/:id', () => {
  it('requires authentication', async () => {
    const response = await createBrowser()('GET', '/api/bookings/1');
    expect(response.status).toBe(401);
  });

  it("returns the hiker's own booking with its slot and tables", async () => {
    const browser = await loginAsHiker();

    const created = await browser('POST', '/api/bookings', {
      slotId: getSlot.id,
      numberOfPeople: 2
    });
    expect(created.status).toBe(201);

    const response = await browser('GET', `/api/bookings/${created.data.id}`);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      id: created.data.id,
      hikerId: hiker.id,
      slotId: getSlot.id,
      numberOfPeople: 2,
      status: 'CONFIRMED',
      slot: {
        id: getSlot.id,
        date: getSlot.date,
        meal: getSlot.meal
      },
      tables: [
        {
          id: getTable.id,
          tableNumber: getTable.tableNumber,
          allocatedSeats: 2
        }
      ]
    });
  });

  it('returns 404 for a booking that does not exist', async () => {
    const browser = await loginAsHiker();
    const response = await browser('GET', '/api/bookings/999999');
    expect(response.status).toBe(404);
  });

  it('returns every allocated table for a booking split across more than one', async () => {
    const browser = await loginAsHiker();

    const created = await browser('POST', '/api/bookings', {
      slotId: multiTableSlot.id,
      numberOfPeople: 4
    });
    expect(created.status).toBe(201);
    expect(created.data.tables).toHaveLength(2);

    const response = await browser('GET', `/api/bookings/${created.data.id}`);

    expect(response.status).toBe(200);
    expect(response.data.tables).toHaveLength(2);
    expect(response.data.tables.map((table) => table.id).sort()).toEqual(
      [multiTableA.id, multiTableB.id].sort()
    );
  });

  it("rejects viewing another hiker's booking", async () => {
    const browser = await loginAsHiker();

    const created = await browser('POST', '/api/bookings', {
      slotId: forbiddenSlot.id,
      numberOfPeople: 1
    });
    expect(created.status).toBe(201);

    const otherBrowser = await loginAsOtherHiker();
    const response = await otherBrowser('GET', `/api/bookings/${created.data.id}`);

    expect(response.status).toBe(403);
  });
});

describe('GET /api/bookings', () => {
  it('requires authentication', async () => {
    const response = await createBrowser()('GET', '/api/bookings');
    expect(response.status).toBe(401);
  });

  it("lists only the authenticated hiker's own bookings", async () => {
    const browser = await loginAsHiker();
    const response = await browser('GET', '/api/bookings');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data.every((booking) => booking.hikerId === hiker.id)).toBe(true);

    // The eager-loaded tables (belongsToMany) must not duplicate a booking row.
    const bookingIds = response.data.map((booking) => booking.id);
    expect(new Set(bookingIds).size).toBe(bookingIds.length);

    // Sorted by the slot's date, most recent first.
    const slotDates = response.data.map((booking) => booking.slot.date);
    const sortedDescending = [...slotDates].sort().reverse();
    expect(slotDates).toEqual(sortedDescending);

    const otherBrowser = await loginAsOtherHiker();
    const otherResponse = await otherBrowser('GET', '/api/bookings');

    const otherBookingIds = otherResponse.data.map((booking) => booking.id);
    const hikerBookingIds = response.data.map((booking) => booking.id);
    expect(otherBookingIds.some((id) => hikerBookingIds.includes(id))).toBe(false);
  });
});
