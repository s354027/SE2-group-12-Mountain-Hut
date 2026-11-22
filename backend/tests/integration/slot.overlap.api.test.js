// MH-78: integration tests for the overlapping-slot validation (MH-02).
// "It is not possible to have two slots overlapping but they can be contiguous."
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'mh-slot-overlap-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');

const PASSWORD = 'test-password-123';
const EMPLOYEE = {
  firstName: 'Test',
  lastName: 'Employee',
  email: 'employee.overlap@test.it',
  role: 'EMPLOYEE'
};
const HIKER = {
  firstName: 'Test',
  lastName: 'Hiker',
  email: 'hiker.overlap@test.it',
  role: 'HIKER'
};

const DATE = '2030-07-10';
const OTHER_DATE = '2030-07-11';
const OVERLAP_ERROR = { error: 'Slot overlaps with an existing slot' };

let server;
let baseUrl;
let employee;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await hashPassword(PASSWORD);
  await models.User.create({ ...EMPLOYEE, passwordHash });
  await models.User.create({ ...HIKER, passwordHash });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  employee = await login(EMPLOYEE.email);
});

beforeEach(async () => {
  await models.Slot.destroy({ where: {} });
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

async function login(email) {
  const browser = createBrowser();
  const response = await browser('POST', '/api/auth/login', { email, password: PASSWORD });
  expect(response.status).toBe(200);
  return browser;
}

function slotBody(startTime, duration, overrides = {}) {
  return {
    date: DATE,
    startTime,
    duration,
    meal: 'LUNCH',
    totalCapacity: 10,
    ...overrides
  };
}

async function createSlot(startTime, duration, overrides) {
  const response = await employee('POST', '/api/slots', slotBody(startTime, duration, overrides));
  expect(response.status).toBe(201);
  return response.data;
}

describe('POST /api/slots - overlapping-slot validation', () => {
  it('rejects a slot that partially overlaps an existing one on the same day', async () => {
    await createSlot('12:00', 60);

    const response = await employee('POST', '/api/slots', slotBody('12:30', 60));

    expect(response.status).toBe(409);
    expect(response.data).toEqual(OVERLAP_ERROR);
    expect(await models.Slot.count()).toBe(1);
  });

  it('rejects an identical slot', async () => {
    await createSlot('12:00', 60);

    const response = await employee('POST', '/api/slots', slotBody('12:00', 60));

    expect(response.status).toBe(409);
    expect(await models.Slot.count()).toBe(1);
  });

  it('rejects a slot that fully contains an existing one', async () => {
    await createSlot('12:30', 30);

    const response = await employee('POST', '/api/slots', slotBody('12:00', 120));

    expect(response.status).toBe(409);
    expect(await models.Slot.count()).toBe(1);
  });

  it('rejects a slot fully inside an existing one', async () => {
    await createSlot('12:00', 120);

    const response = await employee('POST', '/api/slots', slotBody('12:30', 30));

    expect(response.status).toBe(409);
    expect(await models.Slot.count()).toBe(1);
  });

  it('accepts contiguous slots (MH-02 example: 12-13 and 13-14)', async () => {
    await createSlot('12:00', 60);

    const response = await employee('POST', '/api/slots', slotBody('13:00', 60));

    expect(response.status).toBe(201);
    expect(await models.Slot.count()).toBe(2);
  });

  it('accepts a slot that fits exactly between two existing slots', async () => {
    await createSlot('12:00', 60);
    await createSlot('14:00', 60);

    const response = await employee('POST', '/api/slots', slotBody('13:00', 60));

    expect(response.status).toBe(201);
    expect(await models.Slot.count()).toBe(3);
  });

  it('accepts a slot that ends exactly when an existing slot starts', async () => {
    await createSlot('13:00', 60);

    const response = await employee('POST', '/api/slots', slotBody('12:00', 60));

    expect(response.status).toBe(201);
  });

  it('accepts lunch and dinner on the same day', async () => {
    await createSlot('12:00', 90);

    const response = await employee(
      'POST',
      '/api/slots',
      slotBody('19:00', 90, { meal: 'DINNER' })
    );

    expect(response.status).toBe(201);
  });

  it('accepts the same time range on a different date', async () => {
    await createSlot('12:00', 60);

    const response = await employee(
      'POST',
      '/api/slots',
      slotBody('12:00', 60, { date: OTHER_DATE })
    );

    expect(response.status).toBe(201);
    expect(await models.Slot.count()).toBe(2);
  });
});

describe('PUT /api/slots/:id - overlapping-slot validation', () => {
  it('rejects moving a slot into the interval of another slot and keeps it unchanged', async () => {
    await createSlot('12:00', 60);
    const dinner = await createSlot('19:00', 60, { meal: 'DINNER' });

    const response = await employee('PUT', `/api/slots/${dinner.id}`, { startTime: '12:30' });

    expect(response.status).toBe(409);
    expect(response.data).toEqual(OVERLAP_ERROR);

    const stored = await models.Slot.findByPk(dinner.id);
    expect(stored.startTime).toMatch(/^19:00/);
  });

  it('rejects extending the duration into the next slot', async () => {
    const first = await createSlot('12:00', 60);
    await createSlot('13:00', 60);

    const response = await employee('PUT', `/api/slots/${first.id}`, { duration: 90 });

    expect(response.status).toBe(409);
    const stored = await models.Slot.findByPk(first.id);
    expect(stored.duration).toBe(60);
  });

  it('rejects moving a slot to another date where it would overlap', async () => {
    const slot = await createSlot('12:00', 60);
    await createSlot('12:30', 60, { date: OTHER_DATE });

    const response = await employee('PUT', `/api/slots/${slot.id}`, { date: OTHER_DATE });

    expect(response.status).toBe(409);
    const stored = await models.Slot.findByPk(slot.id);
    expect(stored.date).toBe(DATE);
  });

  it('does not count the slot itself when updating other fields', async () => {
    const slot = await createSlot('12:00', 60);

    const response = await employee('PUT', `/api/slots/${slot.id}`, {
      totalCapacity: 20,
      status: 'CLOSED'
    });

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ totalCapacity: 20, status: 'CLOSED' });
  });

  it('allows shifting a slot within its own interval', async () => {
    const slot = await createSlot('12:00', 60);

    const response = await employee('PUT', `/api/slots/${slot.id}`, { startTime: '12:15' });

    expect(response.status).toBe(200);
    expect(response.data.startTime).toMatch(/^12:15/);
  });

  it('allows moving a slot to a contiguous position', async () => {
    await createSlot('12:00', 60);
    const dinner = await createSlot('19:00', 60, { meal: 'DINNER' });

    const response = await employee('PUT', `/api/slots/${dinner.id}`, {
      startTime: '13:00',
      meal: 'LUNCH'
    });

    expect(response.status).toBe(200);
    expect(response.data.startTime).toMatch(/^13:00/);
  });
});

describe('Slot overlap validation - access control', () => {
  it('requires authentication before validating', async () => {
    const response = await createBrowser()('POST', '/api/slots', slotBody('12:00', 60));

    expect(response.status).toBe(401);
    expect(await models.Slot.count()).toBe(0);
  });

  it('forbids hikers from creating slots', async () => {
    const hiker = await login(HIKER.email);

    const response = await hiker('POST', '/api/slots', slotBody('12:00', 60));

    expect(response.status).toBe(403);
    expect(await models.Slot.count()).toBe(0);
  });
});
