import { test, expect } from './fixtures.js';

function futureDate(offset = 4) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

async function createBooking(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('hiker.demo@mountainhut.local');
  await page.getByLabel('Password', { exact: true }).fill('DemoHiker123');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/search');
  await page.getByLabel('YOUR DATE').fill(futureDate());
  await page.getByLabel('ARRIVAL TIME').fill('12:00');
  await page.getByLabel('YOUR PARTY').selectOption('2');
  await page.getByRole('button', { name: /FIND A TABLE/i }).click();
  await expect(page.getByText('AVAILABLE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /CONTINUE TO BOOKING/i }).click();
  await expect(page).toHaveURL('/booking');
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Your table has been reserved successfully. You will receive a confirmation email.')).toBeVisible();
  await page.goto('/bookings');
  await expect(page.getByRole('button', { name: 'Modify booking' })).toBeVisible();
}

async function openEditor(page) {
  await page.getByRole('button', { name: 'Modify booking' }).click();
  return page.getByRole('dialog', { name: 'Modify booking' });
}

test('MH-82: hiker changes party size and the update persists after reload', async ({ page }) => {
  await createBooking(page);
  const dialog = await openEditor(page);
  await dialog.getByLabel('Number of guests').fill('3');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeEnabled();

  const responsePromise = page.waitForResponse(response =>
    /\/api\/bookings\/\d+$/.test(new URL(response.url()).pathname) &&
    response.request().method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.hiker-booking-card').first().locator('dd').first()).toHaveText('3');
});

test('MH-82: hiker changes the booking date and the new date persists', async ({ page }) => {
  await createBooking(page);
  const dialog = await openEditor(page);
  await dialog.getByLabel('Date', { exact: true }).fill(futureDate(5));
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  const responsePromise = page.waitForResponse(response =>
    /\/api\/bookings\/\d+$/.test(new URL(response.url()).pathname) &&
    response.request().method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const expected = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${futureDate(5)}T12:00:00`));
  await expect(page.locator('.hiker-booking-card').first()).toContainText(expected);
});

test('MH-82: unchanged booking closes without sending a modification', async ({ page }) => {
  await createBooking(page);
  const dialog = await openEditor(page);
  let patchRequests = 0;
  page.on('request', request => {
    if (request.method() === 'PATCH' && /\/api\/bookings\/\d+$/.test(new URL(request.url()).pathname)) patchRequests++;
  });
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Back' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(patchRequests).toBe(0);
});
