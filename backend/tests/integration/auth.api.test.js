// MH-27 - Integration tests: login, logout, session and role-based access
// through the real Express app and a real (temporary) SQLite database.
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use a throw-away database, never the real one.
// This must be set BEFORE the app is imported, hence the dynamic imports.
const tmpDir = mkdtempSync(join(tmpdir(), 'mh-auth-test-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { default: app } = await import('../../src/app.js');
const { sequelize, models } = await import('../../src/db/index.js');
const { hashPassword } = await import('../../src/services/authService.js');
const { requireAuth } = await import('../../src/middleware/requireAuth.js');
const { requireRole } = await import('../../src/middleware/requireRole.js');

// No real route uses requireRole yet, so we add small test-only routes.
// TODO: when the real routes exist (slots = staff, booking = hiker), add them to ROUTES.
const ROUTES = {
  '/test/any-logged-in': [requireAuth],
  '/test/hiker-only': [requireRole('HIKER')],
  '/test/staff-only': [requireRole('EMPLOYEE', 'WARDEN')],
  '/test/warden-only': [requireRole('WARDEN')],
};
for (const [path, middlewares] of Object.entries(ROUTES)) {
  app.get(path, ...middlewares, (_req, res) => res.status(200).json({ ok: true }));
}

const PASSWORD = 'pass1234';
const USERS = {
  HIKER: { email: 'hiker@test.it', firstName: 'Hiker', lastName: 'Test' },
  EMPLOYEE: { email: 'employee@test.it', firstName: 'Employee', lastName: 'Test' },
  WARDEN: { email: 'warden@test.it', firstName: 'Warden', lastName: 'Test' },
};

let server;
let baseUrl;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const passwordHash = await hashPassword(PASSWORD);
  for (const [role, data] of Object.entries(USERS)) {
    await models.User.create({ ...data, passwordHash, role });
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
    return { status: res.status, data, setCookie };
  };
}

async function loginAs(role) {
  const browser = newBrowser();
  const res = await browser('POST', '/api/auth/login', { email: USERS[role].email, password: PASSWORD });
  expect(res.status).toBe(200);
  return browser;
}

describe('login', () => {
  for (const role of Object.keys(USERS)) {
    it(`${role} can log in and gets the right role`, async () => {
      const browser = newBrowser();
      const res = await browser('POST', '/api/auth/login', { email: USERS[role].email, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.data.role).toBe(role);
      expect(res.data.firstName).toBe(USERS[role].firstName);
    });
  }

  it('the answer never contains the password or its hash', async () => {
    const browser = newBrowser();
    const res = await browser('POST', '/api/auth/login', { email: USERS.HIKER.email, password: PASSWORD });
    expect('passwordHash' in res.data).toBe(false);
    expect('password' in res.data).toBe(false);
  });

  it('the password is stored hashed, not in clear text', async () => {
    const user = await models.User.findOne({ where: { email: USERS.HIKER.email } });
    expect(user.passwordHash).not.toBe(PASSWORD);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  it('the session cookie is HttpOnly', async () => {
    const browser = newBrowser();
    const res = await browser('POST', '/api/auth/login', { email: USERS.HIKER.email, password: PASSWORD });
    expect(res.setCookie.some((c) => /httponly/i.test(c))).toBeTruthy();
  });

  it('wrong password -> 401', async () => {
    const res = await newBrowser()('POST', '/api/auth/login', { email: USERS.HIKER.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('unknown email -> 401 with the same message as a wrong password', async () => {
    const browser = newBrowser();
    const unknown = await browser('POST', '/api/auth/login', { email: 'nobody@test.it', password: PASSWORD });
    const wrong = await browser('POST', '/api/auth/login', { email: USERS.HIKER.email, password: 'wrong' });
    expect(unknown.status).toBe(401);
    expect(unknown.data).toEqual(wrong.data); // does not reveal which emails exist
  });

  it('missing password -> 400', async () => {
    const res = await newBrowser()('POST', '/api/auth/login', { email: USERS.HIKER.email });
    expect(res.status).toBe(400);
  });

  it('missing email -> 400', async () => {
    const res = await newBrowser()('POST', '/api/auth/login', { password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it('request without a body -> 400', async () => {
    const res = await newBrowser()('POST', '/api/auth/login');
    expect(res.status).toBe(400);
  });
});

describe('session: /me and logout', () => {
  it('/me without logging in -> 401', async () => {
    const res = await newBrowser()('GET', '/api/auth/me');
    expect(res.status).toBe(401);
  });

  for (const role of Object.keys(USERS)) {
    it(`/me after login returns the ${role} session`, async () => {
      const browser = await loginAs(role);
      const res = await browser('GET', '/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.data.role).toBe(role);
    });
  }

  it('after logout the session is gone (204, then /me -> 401)', async () => {
    const browser = await loginAs('HIKER');
    const out = await browser('POST', '/api/auth/logout');
    expect(out.status).toBe(204);
    const me = await browser('GET', '/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('logout when not logged in does not fail', async () => {
    const res = await newBrowser()('POST', '/api/auth/logout');
    expect(res.status).toBe(204);
  });

  it('two users at the same time do not share a session', async () => {
    const hiker = await loginAs('HIKER');
    const warden = await loginAs('WARDEN');
    expect((await hiker('GET', '/test/warden-only')).status).toBe(403);
    expect((await warden('GET', '/test/warden-only')).status).toBe(200);
    expect((await hiker('GET', '/api/auth/me')).data.role).toBe('HIKER');
  });
});

describe('access allowed and denied for each role', () => {
  // Expected HTTP status for [role, route]. Anonymous = not logged in.
  const EXPECTED = {
    ANONYMOUS: { any: 401, hiker: 401, staff: 401, warden: 401 },
    HIKER:     { any: 200, hiker: 200, staff: 403, warden: 403 },
    EMPLOYEE:  { any: 200, hiker: 403, staff: 200, warden: 403 },
    WARDEN:    { any: 200, hiker: 403, staff: 200, warden: 200 },
  };
  const PATHS = {
    any: '/test/any-logged-in',
    hiker: '/test/hiker-only',
    staff: '/test/staff-only',
    warden: '/test/warden-only',
  };

  for (const [who, expectations] of Object.entries(EXPECTED)) {
    for (const [route, status] of Object.entries(expectations)) {
      const verdict = status === 200 ? 'allowed' : status === 401 ? 'asked to log in (401)' : 'denied (403)';
      it(`${who} on the ${route} page: ${verdict}`, async () => {
        const browser = who === 'ANONYMOUS' ? newBrowser() : await loginAs(who);
        const res = await browser('GET', PATHS[route]);
        expect(res.status).toBe(status);
      });
    }
  }
});
