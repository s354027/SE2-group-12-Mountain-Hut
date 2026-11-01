// MH-27 - INTEGRATION tests: registration (POST /api/auth/register)
// and staff creation by the warden (POST /api/admin/staff).
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Throw-away database, never the real one. Must be set BEFORE importing the app.
const tmpDir = mkdtempSync(join(tmpdir(), 'mh-register-test-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');

const PASSWORD = 'pass1234';
let server;
let baseUrl;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await hashPassword(PASSWORD);
  for (const role of ['HIKER', 'EMPLOYEE', 'WARDEN']) {
    await models.User.create({
      firstName: role, lastName: 'Seed', email: `${role.toLowerCase()}@seed.it`, passwordHash, role,
    });
  }
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

// A tiny "browser": it remembers the session cookie between requests.
function newBrowser() {
  let cookie = '';
  return async function request(method, path, body) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie();
    if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { status: res.status, data };
  };
}

async function loginAs(email) {
  const browser = newBrowser();
  const res = await browser('POST', '/api/auth/login', { email, password: PASSWORD });
  expect(res.status).toBe(200);
  return browser;
}

let counter = 0;
const newHiker = (extra = {}) => {
  counter += 1;
  return {
    firstName: 'Anna', lastName: 'Rossi', email: `anna${counter}@test.it`,
    password: 'secret123', phone: '3331234567', ...extra,
  };
};

describe('registration', () => {
  it('a new visitor can register and becomes a HIKER (201)', async () => {
    const data = newHiker();
    const res = await newBrowser()('POST', '/api/auth/register', data);
    expect(res.status).toBe(201);
    expect(res.data.role).toBe('HIKER');
    expect(res.data.email).toBe(data.email);
    expect(res.data.firstName).toBe('Anna');
  });

  it('the answer never contains the password or its hash', async () => {
    const res = await newBrowser()('POST', '/api/auth/register', newHiker());
    expect('passwordHash' in res.data).toBe(false);
    expect('password' in res.data).toBe(false);
  });

  it('the password is stored hashed (bcrypt), not in clear text', async () => {
    const data = newHiker();
    await newBrowser()('POST', '/api/auth/register', data);
    const user = await models.User.findOne({ where: { email: data.email } });
    expect(user.passwordHash).not.toBe(data.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('after registering the user is already logged in', async () => {
    const browser = newBrowser();
    await browser('POST', '/api/auth/register', newHiker());
    const me = await browser('GET', '/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.data.role).toBe('HIKER');
  });

  it('the new account can log in later with the same password', async () => {
    const data = newHiker();
    await newBrowser()('POST', '/api/auth/register', data);
    const res = await newBrowser()('POST', '/api/auth/login', { email: data.email, password: data.password });
    expect(res.status).toBe(200);
    expect(res.data.role).toBe('HIKER');
  });

  it('a visitor cannot make themselves WARDEN or EMPLOYEE (role in the body is ignored)', async () => {
    for (const role of ['WARDEN', 'EMPLOYEE']) {
      const res = await newBrowser()('POST', '/api/auth/register', newHiker({ role }));
      expect(res.status).toBe(201);
      expect(res.data.role).toBe('HIKER');
    }
  });

  it('the email is saved in lowercase', async () => {
    const data = newHiker();
    const res = await newBrowser()('POST', '/api/auth/register', { ...data, email: data.email.toUpperCase() });
    expect(res.status).toBe(201);
    expect(res.data.email).toBe(data.email);
  });

  it('optional fields (notes, emergency contact) are saved', async () => {
    const data = newHiker({ notes: 'Vegetarian', emergencyContact: '3339999999' });
    await newBrowser()('POST', '/api/auth/register', data);
    const user = await models.User.findOne({ where: { email: data.email } });
    expect(user.notes).toBe('Vegetarian');
    expect(user.emergencyContact).toBe('3339999999');
  });

  for (const field of ['firstName', 'lastName', 'email', 'password', 'phone']) {
    it(`missing ${field} -> 400`, async () => {
      const data = newHiker();
      delete data[field];
      const res = await newBrowser()('POST', '/api/auth/register', data);
      expect(res.status).toBe(400);
    });
  }

  it('request without a body -> 400', async () => {
    const res = await newBrowser()('POST', '/api/auth/register');
    expect(res.status).toBe(400);
  });

  for (const email of ['not-an-email', 'a@b', 'a b@c.it', '@test.it']) {
    it(`invalid email "${email}" -> 400`, async () => {
      const res = await newBrowser()('POST', '/api/auth/register', newHiker({ email }));
      expect(res.status).toBe(400);
    });
  }

  it('password shorter than 6 characters -> 400, exactly 6 is accepted', async () => {
    const short = await newBrowser()('POST', '/api/auth/register', newHiker({ password: '12345' }));
    expect(short.status).toBe(400);
    const ok = await newBrowser()('POST', '/api/auth/register', newHiker({ password: '123456' }));
    expect(ok.status).toBe(201);
  });

  it('an email that is already registered -> 409', async () => {
    const data = newHiker();
    expect((await newBrowser()('POST', '/api/auth/register', data)).status).toBe(201);
    expect((await newBrowser()('POST', '/api/auth/register', data)).status).toBe(409);
  });

  it('the same email in capital letters is also a duplicate -> 409', async () => {
    const data = newHiker();
    await newBrowser()('POST', '/api/auth/register', data);
    const res = await newBrowser()('POST', '/api/auth/register', { ...data, email: data.email.toUpperCase() });
    expect(res.status).toBe(409);
  });

  it('a failed registration does not log anyone in', async () => {
    const browser = newBrowser();
    await browser('POST', '/api/auth/register', newHiker({ password: '1' }));
    expect((await browser('GET', '/api/auth/me')).status).toBe(401);
  });
});

describe('staff creation: only the WARDEN may create EMPLOYEE / WARDEN accounts', () => {
  const newStaff = (extra = {}) => {
    counter += 1;
    return { firstName: 'Luca', lastName: 'Bianchi', email: `staff${counter}@test.it`, password: 'secret123', role: 'EMPLOYEE', ...extra };
  };

  it('not logged in -> 401', async () => {
    const res = await newBrowser()('POST', '/api/admin/staff', newStaff());
    expect(res.status).toBe(401);
  });

  for (const email of ['hiker@seed.it', 'employee@seed.it']) {
    it(`${email.split('@')[0].toUpperCase()} is denied -> 403`, async () => {
      const browser = await loginAs(email);
      const res = await browser('POST', '/api/admin/staff', newStaff());
      expect(res.status).toBe(403);
    });
  }

  it('a denied request creates nothing in the database', async () => {
    const data = newStaff();
    const browser = await loginAs('hiker@seed.it');
    await browser('POST', '/api/admin/staff', data);
    expect(await models.User.findOne({ where: { email: data.email } })).toBeNull();
  });

  for (const role of ['EMPLOYEE', 'WARDEN']) {
    it(`the WARDEN can create a ${role}, who can then log in with that role`, async () => {
      const warden = await loginAs('warden@seed.it');
      const data = newStaff({ role });
      const res = await warden('POST', '/api/admin/staff', data);
      expect(res.status).toBe(201);
      expect(res.data.role).toBe(role);
      expect('passwordHash' in res.data).toBe(false);

      const login = await newBrowser()('POST', '/api/auth/login', { email: data.email, password: data.password });
      expect(login.status).toBe(200);
      expect(login.data.role).toBe(role);
    });
  }

  it('the role HIKER is not allowed here -> 400', async () => {
    const warden = await loginAs('warden@seed.it');
    const res = await warden('POST', '/api/admin/staff', newStaff({ role: 'HIKER' }));
    expect(res.status).toBe(400);
  });

  for (const field of ['firstName', 'lastName', 'email', 'password', 'role']) {
    it(`missing ${field} -> 400`, async () => {
      const warden = await loginAs('warden@seed.it');
      const data = newStaff();
      delete data[field];
      expect((await warden('POST', '/api/admin/staff', data)).status).toBe(400);
    });
  }

  it('invalid email -> 400', async () => {
    const warden = await loginAs('warden@seed.it');
    expect((await warden('POST', '/api/admin/staff', newStaff({ email: 'nope' }))).status).toBe(400);
  });

  it('an email that is already registered -> 409', async () => {
    const warden = await loginAs('warden@seed.it');
    const res = await warden('POST', '/api/admin/staff', newStaff({ email: 'hiker@seed.it' }));
    expect(res.status).toBe(409);
  });
});
