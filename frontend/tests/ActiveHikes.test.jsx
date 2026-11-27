import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ActiveHikes from '../src/pages/staff/ActiveHikes.jsx';

function jsonResponse(status, data) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('loads and displays active hike details', async () => {
  const hike = {
    id: 1,
    hiker: { firstName: 'Ada', lastName: 'Lovelace' },
    destination: 'Rifugio Gastaldi',
    route: 'Via the Chiaretto lake',
    waypoints: ['Viso Mozzo'],
    departureTime: '2030-07-14T06:00:00.000Z',
    expectedReturnTime: '2030-07-14T18:00:00.000Z',
  };
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [hike]));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = render(<ActiveHikes />);

  expect(screen.getByRole('status')).toHaveTextContent('Loading active hikes');
  expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
  expect(screen.getByText('Rifugio Gastaldi')).toBeInTheDocument();
  expect(screen.getByText('Via the Chiaretto lake')).toBeInTheDocument();
  expect(screen.getByText('Viso Mozzo')).toBeInTheDocument();
  expect(
    screen.queryByRole('navigation', { name: 'Active hikes pages' }),
  ).not.toBeInTheDocument();
  expect(
    container.querySelector('time[datetime="2030-07-14T18:00:00.000Z"]'),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/hikes/active',
    expect.objectContaining({ credentials: 'include' }),
  );
});

test('refreshes active hikes every minute', async () => {
  vi.useFakeTimers();
  const firstHike = {
    id: 1,
    hiker: { firstName: 'Ada', lastName: 'Lovelace' },
    destination: 'Rifugio Gastaldi',
    expectedReturnTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const refreshedHike = {
    ...firstHike,
    hiker: { firstName: 'Grace', lastName: 'Hopper' },
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(200, [firstHike]))
    .mockResolvedValueOnce(jsonResponse(200, [refreshedHike]));
  vi.stubGlobal('fetch', fetchMock);
  render(<ActiveHikes />);

  expect(
    await screen.findByRole('heading', { name: 'Ada Lovelace' }),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });

  expect(
    await screen.findByRole('heading', { name: 'Grace Hopper' }),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('shows an empty state when there are no active hikes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));
  render(<ActiveHikes />);

  expect(
    await screen.findByText('There are no active hikes to display.'),
  ).toBeInTheDocument();
});

test('shows an error when the active hikes request fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        jsonResponse(500, { error: 'Failed to retrieve active hikes' }),
      ),
  );
  render(<ActiveHikes />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Failed to retrieve active hikes',
  );
});

test('paginates two hikes at a time, filters by status and orders by expected return', async () => {
  const now = Date.now();
  const hikes = [
    {
      id: 1,
      hiker: { firstName: 'Alex', lastName: 'Track' },
      destination: 'Mount A',
      expectedReturnTime: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      hiker: { firstName: 'Blair', lastName: 'Soon' },
      destination: 'Lake B',
      expectedReturnTime: new Date(now + 10 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      hiker: { firstName: 'Casey', lastName: 'Late' },
      destination: 'Ridge C',
      expectedReturnTime: new Date(now - 5 * 60 * 1000).toISOString(),
    },
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, hikes)));
  render(<ActiveHikes />);

  expect(screen.queryByRole('button', { name: /due soon/i })).not.toBeInTheDocument();
  expect(
    screen.getByRole('group', { name: 'Filter hikes by return status' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Casey Late' })).toBeInTheDocument();
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(['Casey Late', 'Blair Soon']);
  expect(
    screen.getByRole('button', { name: '1' }),
  ).toHaveAttribute('aria-current', 'page');

  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

  expect(screen.getByRole('heading', { name: 'Alex Track' })).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Casey Late' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: '2' }),
  ).toHaveAttribute('aria-current', 'page');

  fireEvent.click(screen.getByRole('button', { name: 'On track (1)' }));

  expect(screen.getByRole('heading', { name: 'Alex Track' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Blair Soon' })).not.toBeInTheDocument();
  expect(screen.getByText('1 hike')).toBeInTheDocument();
  expect(
    screen.queryByRole('navigation', { name: 'Active hikes pages' }),
  ).not.toBeInTheDocument();
});

test('shows a status-specific empty state with a shortcut back to all hikes', async () => {
  const hike = {
    id: 1,
    hiker: { firstName: 'Alex', lastName: 'Track' },
    destination: 'Mount A',
    expectedReturnTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [hike])));
  render(<ActiveHikes />);

  await screen.findByRole('heading', { name: 'Alex Track' });
  fireEvent.click(screen.getByRole('button', { name: 'Overdue' }));

  expect(await screen.findByText('No overdue hikes right now.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show all hikes' }));

  expect(screen.getByRole('heading', { name: 'Alex Track' })).toBeInTheDocument();
});
