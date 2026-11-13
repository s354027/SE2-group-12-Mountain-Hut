// MH-67: integration tests for MH-05 "Provide party requirements".
// A booking carries a list of requirements for subsets of the party, each with
// its own allergies flag and description (MH-05), and the confirmation email
// must report them (MH-03).
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Replace only the SMTP layer: the real notifyBookingConfirmed still reads the
// booking from the database and builds the email payload.
vi.mock('../../src/services/emailService.js', () => ({
  sendBookingConfirmation: vi.fn().mockResolvedValue(true),
  verifyTransporter: vi.fn()
}));

const tmpDir = mkdtempSync(join(tmpdir(), 'mh-booking-requirements-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');
const { sendBookingConfirmation } = await import('../../src/services/emailService.js');

const PASSWORD = 'test-password-123';
const HIKER = {
  firstName: 'Anna',
  lastName: 'Rossi',
  email: 'hiker.requirements@test.it',
  role: 'HIKER'
};
const OTHER_HIKER = {
  firstName: 'Marco',
  lastName: 'Bianchi',
  email: 'other.requirements@test.it',
  role: 'HIKER'
};
const EMPLOYEE = {
  firstName: 'Test',
  lastName: 'Employee',
  email: 'employee.requirements@test.it',
  role: 'EMPLOYEE'
};

// Example from the MH-05 clarifications.
const REQUIREMENTS = [
  { allergies: true, description: '1 vegan, peanut allergy' },
  { allergies: true, description: '1 shellfish allergy' },
  { allergies: false, description: '2 vegetarians' }
];

let server;
let baseUrl;
let hiker;
let slot;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await hashPassword(PASSWORD);
  hiker = await models.User.create({ ...HIKER, passwordHash });
  await models.User.create({ ...OTHER_HIKER, passwordHash });
  await models.User.create({ ...EMPLOYEE, passwordHash });

  slot = await models.Slot.create({
    date: '2030-08-20',
    startTime: '12:00',
    duration: 90,
    meal: 'LUNCH',
    totalCapacity: 8,
    status: 'OPEN'
  });

  const tables = await models.DiningTable.bulkCreate([
    { tableNumber: 1, seats: 4 },
    { tableNumber: 2, seats: 4 }
  ]);

  await models.SlotTable.bulkCreate(
    tables.map((table) => ({ slotId: slot.id, tableId: table.id }))
  );

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  // The rule is one booking per hiker per slot: start every test from a clean slot.
  await models.BookingTable.destroy({ where: {} });
  await models.Booking.destroy({ where: {} });

  sendBookingConfirmation.mockReset();
  sendBookingConfirmation.mockResolvedValue(true);
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

async function readRawRequirements(bookingId) {
  const [rows] = await sequelize.query(
    'SELECT dietaryRequirements FROM bookings WHERE id = ?',
    { replacements: [bookingId] }
  );
  return rows[0].dietaryRequirements;
}

describe('POST /api/bookings - party requirements are persisted (MH-05)', () => {
  it('stores the list of requirements of the MH-05 example', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 6,
      dietaryRequirements: REQUIREMENTS
    });

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      hikerId: hiker.id,
      slotId: slot.id,
      numberOfPeople: 6,
      status: 'CONFIRMED',
      dietaryRequirements: REQUIREMENTS
    });

    const saved = await models.Booking.findByPk(response.data.id);
    expect(saved.dietaryRequirements).toEqual(REQUIREMENTS);

    // Stored as JSON text, since SQLite has no array column.
    const raw = await readRawRequirements(response.data.id);
    expect(typeof raw).toBe('string');
    expect(JSON.parse(raw)).toEqual(REQUIREMENTS);
  });

  it('trims descriptions and keeps only allergies and description', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      dietaryRequirements: [
        { allergies: true, description: '   1 gluten allergy  ', foo: 'bar', id: 99 },
        { allergies: false, description: '\t1 vegetarian\n' }
      ]
    });

    const expected = [
      { allergies: true, description: '1 gluten allergy' },
      { allergies: false, description: '1 vegetarian' }
    ];

    expect(response.status).toBe(201);
    expect(response.data.dietaryRequirements).toEqual(expected);

    const raw = await readRawRequirements(response.data.id);
    expect(JSON.parse(raw)).toEqual(expected);
  });

  it('stores no requirements when the field is omitted', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2
    });

    expect(response.status).toBe(201);
    expect(response.data.dietaryRequirements).toEqual([]);
    expect(await readRawRequirements(response.data.id)).toBeNull();

    const saved = await models.Booking.findByPk(response.data.id);
    expect(saved.dietaryRequirements).toEqual([]);
  });

  it('stores no requirements when an empty list is sent', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      dietaryRequirements: []
    });

    expect(response.status).toBe(201);
    expect(response.data.dietaryRequirements).toEqual([]);
    expect(await readRawRequirements(response.data.id)).toBeNull();
  });

  it('stores a requirement without the allergies flag set', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      dietaryRequirements: [{ allergies: false, description: '2 vegetarians' }]
    });

    expect(response.status).toBe(201);

    const saved = await models.Booking.findByPk(response.data.id);
    expect(saved.dietaryRequirements).toEqual([
      { allergies: false, description: '2 vegetarians' }
    ]);
    expect(saved.allergyFlag).toBe(false);
  });

  it('stores the booking-level allergy together with the requirements list', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 3,
      allergyFlag: true,
      allergyDescription: '  Peanuts  ',
      dietaryRequirements: [{ allergies: false, description: '2 vegetarians' }]
    });

    expect(response.status).toBe(201);

    const saved = await models.Booking.findByPk(response.data.id);
    expect(saved.allergyFlag).toBe(true);
    expect(saved.allergyDescription).toBe('Peanuts');
    expect(saved.dietaryRequirements).toEqual([
      { allergies: false, description: '2 vegetarians' }
    ]);
  });

  it('keeps the requirements of each booking separate on the same slot', async () => {
    const first = await login(HIKER.email);
    const second = await login(OTHER_HIKER.email);

    const firstResponse = await first('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      dietaryRequirements: [{ allergies: true, description: '1 shellfish allergy' }]
    });
    const secondResponse = await second('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      dietaryRequirements: [{ allergies: false, description: '2 vegans' }]
    });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    const firstSaved = await models.Booking.findByPk(firstResponse.data.id);
    const secondSaved = await models.Booking.findByPk(secondResponse.data.id);

    expect(firstSaved.dietaryRequirements).toEqual([
      { allergies: true, description: '1 shellfish allergy' }
    ]);
    expect(secondSaved.dietaryRequirements).toEqual([
      { allergies: false, description: '2 vegans' }
    ]);
  });
});

describe('POST /api/bookings - invalid party requirements are rejected (MH-05)', () => {
  it.each([
    ['requirements is a string', { dietaryRequirements: 'vegan' }, 'dietaryRequirements must be an array'],
    ['requirements is an object', { dietaryRequirements: {} }, 'dietaryRequirements must be an array'],
    ['an element is null', { dietaryRequirements: [null] }, 'Each dietary requirement must be an object'],
    ['an element is a string', { dietaryRequirements: ['vegan'] }, 'Each dietary requirement must be an object'],
    ['an element is an array', { dietaryRequirements: [[true, 'vegan']] }, 'Each dietary requirement must be an object'],
    [
      'allergies is missing',
      { dietaryRequirements: [{ description: '1 vegan' }] },
      'Each dietary requirement must have an allergies boolean'
    ],
    [
      'allergies is not a boolean',
      { dietaryRequirements: [{ allergies: 'yes', description: '1 vegan' }] },
      'Each dietary requirement must have an allergies boolean'
    ],
    [
      'description is missing',
      { dietaryRequirements: [{ allergies: true }] },
      'Each dietary requirement must have a non-empty description'
    ],
    [
      'description is empty',
      { dietaryRequirements: [{ allergies: true, description: '' }] },
      'Each dietary requirement must have a non-empty description'
    ],
    [
      'description is blank',
      { dietaryRequirements: [{ allergies: false, description: '   ' }] },
      'Each dietary requirement must have a non-empty description'
    ],
    [
      'description is not a string',
      { dietaryRequirements: [{ allergies: false, description: 42 }] },
      'Each dietary requirement must have a non-empty description'
    ],
    [
      'one valid and one invalid element',
      {
        dietaryRequirements: [
          { allergies: false, description: '2 vegetarians' },
          { allergies: true, description: ' ' }
        ]
      },
      'Each dietary requirement must have a non-empty description'
    ],
    [
      'allergy flag without description',
      { allergyFlag: true },
      'Allergy description is required'
    ],
    [
      'allergy flag with blank description',
      { allergyFlag: true, allergyDescription: '   ' },
      'Allergy description is required'
    ],
    [
      'allergy flag is not a boolean',
      { allergyFlag: 'true', allergyDescription: 'Peanuts' },
      'allergyFlag must be a boolean'
    ]
  ])('returns 400 when %s and writes nothing', async (_label, extraBody, expectedError) => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2,
      ...extraBody
    });

    expect(response.status).toBe(400);
    expect(response.data).toEqual({ error: expectedError });

    expect(await models.Booking.count()).toBe(0);
    expect(await models.BookingTable.count()).toBe(0);
    expect(sendBookingConfirmation).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings - access to party requirements', () => {
  const body = () => ({
    slotId: slot.id,
    numberOfPeople: 2,
    dietaryRequirements: REQUIREMENTS
  });

  it('requires authentication', async () => {
    const response = await createBrowser()('POST', '/api/bookings', body());

    expect(response.status).toBe(401);
    expect(await models.Booking.count()).toBe(0);
  });

  it('is reserved to hikers', async () => {
    const employee = await login(EMPLOYEE.email);

    const response = await employee('POST', '/api/bookings', body());

    expect(response.status).toBe(403);
    expect(await models.Booking.count()).toBe(0);
  });
});

describe('POST /api/bookings - party requirements in the confirmation email (MH-03)', () => {
  it('lists every requirement and flags the allergies', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 6,
      dietaryRequirements: REQUIREMENTS
    });

    expect(response.status).toBe(201);
    expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      HIKER.email,
      'Anna Rossi',
      response.data.id,
      '20/08/2030',
      '12:00',
      '13:30',
      6,
      '1 vegan, peanut allergy (allergy), 1 shellfish allergy (allergy), 2 vegetarians'
    );
  });

  it('puts the booking-level allergy before the requirements list', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 3,
      allergyFlag: true,
      allergyDescription: 'Peanuts',
      dietaryRequirements: [{ allergies: false, description: '2 vegetarians' }]
    });

    expect(response.status).toBe(201);
    expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBookingConfirmation.mock.calls[0][7]).toBe('Peanuts (allergy), 2 vegetarians');
  });

  it('sends no requirements when none were provided', async () => {
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 2
    });

    expect(response.status).toBe(201);
    expect(sendBookingConfirmation).toHaveBeenCalledTimes(1);
    expect(sendBookingConfirmation.mock.calls[0][7]).toBeNull();
  });

  it('keeps the booking and its requirements when the email fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sendBookingConfirmation.mockRejectedValue(new Error('SMTP down'));
    const browser = await login(HIKER.email);

    const response = await browser('POST', '/api/bookings', {
      slotId: slot.id,
      numberOfPeople: 6,
      dietaryRequirements: REQUIREMENTS
    });

    expect(response.status).toBe(201);

    const saved = await models.Booking.findByPk(response.data.id);
    expect(saved).not.toBeNull();
    expect(saved.dietaryRequirements).toEqual(REQUIREMENTS);

    console.error.mockRestore();
  });
});
