import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/auth/AuthContext.jsx';

// Routes fetch calls by "METHOD path" to the given { status, body }.
function mockApi(routes) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    const { status, body } = routes[key] ?? { status: 401, body: { error: 'Unauthorized' } };
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

const lastBody = (fetchMock, key) => {
  const call = fetchMock.mock.calls.findLast(([url, o]) => `${o?.method} ${url}` === key);
  return JSON.parse(call[1].body);
};

beforeEach(() => vi.unstubAllGlobals());

describe('forced password change', () => {
  test('a user with mustChangePassword is redirected to /change-password', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { id: 7, role: 'HIKER', mustChangePassword: true } } });
    renderAt('/booking');
    expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/temporary password/i);
  });

  test('login page sends a user that must change the password to /change-password', async () => {
    mockApi({ 'GET /api/auth/me': { status: 200, body: { id: 7, role: 'HIKER', mustChangePassword: true } } });
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument();
  });

  test('change password validates the confirmation', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': { status: 200, body: { id: 7, role: 'HIKER', mustChangePassword: true } } });
    renderAt('/change-password');
    fireEvent.change(await screen.findByLabelText('Temporary password'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/auth/change-password')).toBe(false);
  });

  test('successful change unlocks the protected pages', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': { status: 200, body: { id: 7, role: 'HIKER', mustChangePassword: true } },
      'POST /api/auth/change-password': { status: 204 },
    });
    renderAt('/change-password');
    fireEvent.change(await screen.findByLabelText('Temporary password'), { target: { value: 'oldpass' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('heading', { name: 'Ready for your next stop at the hut?' })).toBeInTheDocument();
    expect(lastBody(fetchMock, 'POST /api/auth/change-password')).toEqual({ currentPassword: 'oldpass', newPassword: 'newpass1' });
  });

  test('wrong current password shows an error', async () => {
    mockApi({
      'GET /api/auth/me': { status: 200, body: { id: 7, role: 'HIKER', mustChangePassword: true } },
      'POST /api/auth/change-password': { status: 401, body: { error: 'Invalid credentials' } },
    });
    renderAt('/change-password');
    fireEvent.change(await screen.findByLabelText('Temporary password'), { target: { value: 'wrong1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The current password is not correct');
  });
});

describe('forgot password', () => {
  test('login page links to forgot password', async () => {
    mockApi({});
    renderAt('/login');
    fireEvent.click(await screen.findByRole('link', { name: 'Forgot password?' }));
    expect(await screen.findByRole('heading', { name: 'Forgot password' })).toBeInTheDocument();
  });

  test('shows a generic message after submitting', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/forgot-password': { status: 200, body: { message: 'ok' } } });
    renderAt('/forgot-password');
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'anna@x.it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists for anna@x.it');
    expect(lastBody(fetchMock, 'POST /api/auth/forgot-password')).toEqual({ email: 'anna@x.it' });
  });
});

describe('reset password', () => {
  test('without token shows an invalid link message', async () => {
    mockApi({});
    renderAt('/reset-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is not valid');
  });

  test('with a valid token sets the new password', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/reset-password': { status: 204 } });
    renderAt('/reset-password?token=abc123');
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been updated');
    expect(lastBody(fetchMock, 'POST /api/auth/reset-password')).toEqual({ token: 'abc123', newPassword: 'newpass1' });
  });

  test('the eye button shows and hides the password', async () => {
    mockApi({});
    renderAt('/reset-password?token=abc123');
    const input = await screen.findByLabelText('New password');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  test('an expired or used link shows the backend error', async () => {
    mockApi({ 'POST /api/auth/reset-password': { status: 400, body: { error: 'Invalid or expired reset link' } } });
    renderAt('/reset-password?token=old');
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'newpass1' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired reset link');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument());
  });
});
