
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

let server;
let baseUrl;
let hiker;
let slot;
let table;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  hiker = await models.User.create({
    ...HIKER,
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
