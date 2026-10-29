import { render, screen } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/auth/AuthContext.jsx';

beforeEach(() => {
  // No session: /api/auth/me answers 401
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }),
  }));
});

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

test('home page is shown', async () => {
  renderAt('/');
  expect(await screen.findByText('Welcome to the Mountain Hut')).toBeInTheDocument();
});

test('a protected page redirects to login when not logged in', async () => {
  renderAt('/booking');
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
});
