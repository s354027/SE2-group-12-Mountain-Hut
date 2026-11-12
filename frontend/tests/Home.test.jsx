import { render, screen, within } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/auth/AuthContext.jsx';

function stubSession(user) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      user
        ? { ok: true, status: 200, json: async () => user }
        : { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) },
    ),
  );
}

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('guest sees the full hut presentation page', async () => {
  stubSession(null);
  renderHome();

  expect(
    await screen.findByRole('heading', { name: 'Welcome to the Mountain Hut' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /check availability/i })).toHaveAttribute(
    'href',
    '/search',
  );
});

test('hiker sees a booking-focused homepage', async () => {
  stubSession({ id: 1, role: 'HIKER' });
  renderHome();

  expect(
    await screen.findByRole('heading', { name: 'Ready for your next stop at the hut?' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /check availability/i })).toHaveAttribute(
    'href',
    '/search',
  );
});

test('employee sees a slot-management homepage', async () => {
  stubSession({ id: 2, role: 'EMPLOYEE' });
  renderHome();

  await screen.findByRole('heading', { name: 'Manage today’s slots and tables' });
  const main = screen.getByRole('main');
  expect(within(main).getByRole('link', { name: /manage slots/i })).toHaveAttribute(
    'href',
    '/staff/slots',
  );
});

test('warden sees the warden homepage, linking to slot management', async () => {
  stubSession({ id: 3, role: 'WARDEN' });
  renderHome();

  await screen.findByRole('heading', { name: 'Run the hut, from slots to staff' });
  const main = screen.getByRole('main');
  expect(within(main).getByRole('link', { name: /manage slots/i })).toHaveAttribute(
    'href',
    '/staff/slots',
  );
  expect(within(main).getByRole('link', { name: /add new staff/i })).toHaveAttribute(
    'href',
    '/admin/staff/new',
  );
});
