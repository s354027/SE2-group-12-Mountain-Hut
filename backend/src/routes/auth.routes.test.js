import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import { db, resetTestDb } from '../testUtils/testDb.js';
import { hashPassword } from '../services/authService.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
  await resetTestDb();
  await db.User.create({
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario.rossi@example.com',
    role: 'HIKER',
    passwordHash: await hashPassword('s3cret-pw')
  });
});

test('POST /api/auth/login succeeds with correct credentials and sets a session cookie', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mario.rossi@example.com', password: 's3cret-pw' })
  });

  assert.equal(res.status, 200);
  assert.ok(res.headers.get('set-cookie')?.includes('connect.sid'));

  const body = await res.json();
  assert.equal(body.role, 'HIKER');
  assert.equal(body.firstName, 'Mario');
  assert.equal(body.passwordHash, undefined);
});

test('POST /api/auth/login rejects a request missing email or password', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mario.rossi@example.com' })
  });

  assert.equal(res.status, 400);
});

test('POST /api/auth/login fails with a wrong password', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mario.rossi@example.com', password: 'wrong-password' })
  });

  assert.equal(res.status, 401);
});

test('POST /api/auth/login fails for an unknown email', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com', password: 's3cret-pw' })
  });

  assert.equal(res.status, 401);
});

test('POST /api/auth/logout clears the session cookie', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mario.rossi@example.com', password: 's3cret-pw' })
  });
  const sessionCookie = loginRes.headers.get('set-cookie').split(';')[0];

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie }
  });

  assert.equal(logoutRes.status, 204);
});
