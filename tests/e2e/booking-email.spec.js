import { test, expect } from "@playwright/test";

const mailpitUrl = "http://localhost:8025";

test.beforeEach(async ({ request }) => {
  const response = await request.delete(
    `${mailpitUrl}/api/v1/messages`,
  );

  expect(response.ok()).toBeTruthy();
});

test("@email sends a booking confirmation email", async ({
  page,
  request,
}) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(
    "hiker.demo@mountainhut.local",
  );
  await page.getByLabel("Password").fill("DemoHiker123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL("/");

  // This development-only route supplies valid availability data.
  await page.goto("/booking-test");
  await page
    .getByRole("button", { name: "Start test booking" })
    .click();

  await page
    .getByRole("button", { name: "Confirm booking" })
    .click();

  const bookingResponsePromise = page.waitForResponse(
  response =>
    response.url().includes("/api/bookings") &&
    response.request().method() === "POST"
  );

  await page
    .getByRole("button", { name: "Continue" })
    .click();

  const bookingResponse = await bookingResponsePromise;

  await expect(
    page.getByText(
      "Your table has been reserved successfully. You will receive a confirmation email.",
    ),
  ).toBeVisible();

  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${mailpitUrl}/api/v1/messages`,
        );

        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        return data.messages ?? [];
      },
      {
        timeout: 10_000,
        intervals: [250, 500, 1000],
      },
    )
    .not.toHaveLength(0);

  const messagesResponse = await request.get(
    `${mailpitUrl}/api/v1/messages`,
  );
  expect(messagesResponse.ok()).toBeTruthy();

  const { messages } = await messagesResponse.json();
  const message = messages[0];

  expect(message.Subject).toMatch(/^Booking Confirmation #\d+$/);
  expect(message.To[0].Address).toBe(
    "hiker.demo@mountainhut.local",
  );

  const detailResponse = await request.get(
    `${mailpitUrl}/api/v1/message/${message.ID}`,
  );

  expect(detailResponse.ok()).toBeTruthy();

  const email = await detailResponse.json();

  expect(email.HTML).toContain("Your Reservation Is Confirmed");
});