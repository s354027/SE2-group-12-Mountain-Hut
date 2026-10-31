// MH-27 - Unit tests for the access-control middleware (no database, no HTTP).
// Question answered: "who is allowed in, and who is turned away?"
import { describe, it, expect } from 'vitest';
import { requireAuth } from '../../src/middleware/requireAuth.js';
import { requireRole } from '../../src/middleware/requireRole.js';

// Minimal fake of the Express response: remembers status code and body.
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// Runs a middleware with a fake request and reports what happened.
function run(middleware, session) {
  const res = fakeRes();
  let nextCalled = false;
  middleware({ session }, res, () => { nextCalled = true; });
  return { status: res.statusCode, nextCalled };
}

const loggedIn = (role) => ({ user: { id: 1, role } });

describe('requireAuth', () => {
  it('no session at all -> 401', () => {
    const r = run(requireAuth, undefined);
    expect(r.status).toBe(401);
    expect(r.nextCalled).toBe(false);
  });

  it('session without a user -> 401', () => {
    const r = run(requireAuth, {});
    expect(r.status).toBe(401);
    expect(r.nextCalled).toBe(false);
  });

  for (const role of ['HIKER', 'EMPLOYEE', 'WARDEN']) {
    it(`logged-in ${role} -> allowed`, () => {
      const r = run(requireAuth, loggedIn(role));
      expect(r.nextCalled).toBe(true);
      expect(r.status).toBe(null); // no error answer was sent
    });
  }
});

describe('requireRole', () => {
  // [roles allowed on the route, then who gets in and who is refused]
  const cases = [
    { allowed: ['HIKER'],               yes: ['HIKER'],               no: ['EMPLOYEE', 'WARDEN'] },
    { allowed: ['EMPLOYEE', 'WARDEN'],  yes: ['EMPLOYEE', 'WARDEN'],  no: ['HIKER'] },
    { allowed: ['WARDEN'],              yes: ['WARDEN'],              no: ['HIKER', 'EMPLOYEE'] },
  ];

  for (const { allowed, yes, no } of cases) {
    const label = allowed.join('+');

    for (const role of yes) {
      it(`route for ${label}: ${role} is allowed`, () => {
        const r = run(requireRole(...allowed), loggedIn(role));
        expect(r.nextCalled).toBe(true);
        expect(r.status).toBe(null);
      });
    }

    for (const role of no) {
      it(`route for ${label}: ${role} is denied with 403`, () => {
        const r = run(requireRole(...allowed), loggedIn(role));
        expect(r.status).toBe(403);
        expect(r.nextCalled).toBe(false);
      });
    }

    it(`route for ${label}: not logged in gets 401 (not 403)`, () => {
      const r = run(requireRole(...allowed), undefined);
      expect(r.status).toBe(401);
      expect(r.nextCalled).toBe(false);
    });
  }

  it('an unknown role is denied', () => {
    const r = run(requireRole('HIKER'), loggedIn('ADMIN'));
    expect(r.status).toBe(403);
  });

  it('role names are case sensitive ("hiker" is not "HIKER")', () => {
    const r = run(requireRole('HIKER'), loggedIn('hiker'));
    expect(r.status).toBe(403);
  });
});
