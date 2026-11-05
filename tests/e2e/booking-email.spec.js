import { test, expect } from "./fixtures.js";

const mailpitUrl = "http://localhost:8025";

function getSearchDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function openBookingFromSearch(page) {
  await page.goto("/login");

  await page.getByLabel("Email").fill(
    "hiker.demo@mountainhut.local",
  );
  await page.getByLabel("Password").fill("DemoHiker123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL("/");

  await page.goto("/search");
  await page.getByLabel("YOUR DATE").fill(getSearchDate());
  await page.getByLabel("ARRIVAL TIME").fill("19:15");
  await page.getByLabel("YOUR PARTY").selectOption("3");
  await page.getByRole("button", { name: "FIND A TABLE" }).click();

  await expect(
    page.getByRole("heading", { name: "A seat in the mountains." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "CONTINUE TO BOOKING" })
    .click();
}

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
  await openBookingFromSearch(page);

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

test("@email includes allergy requirements in booking confirmation", async ({
  page,
  request,
}) => {
  await openBookingFromSearch(page);

  await page
    .getByLabel("I have allergies or dietary requirements")
    .check();

  await page
    .getByLabel("Allergy notes")
    .fill("Severe peanut allergy");

  await page
    .getByRole("button", { name: "Confirm booking" })
    .click();

  await page
    .getByRole("button", { name: "Continue" })
    .click();

  await expect(
    page.getByText(
      "Your table has been reserved successfully. You will receive a confirmation email.",
    ),
  ).toBeVisible();

  await expect(
    page.getByText("Severe peanut allergy", { exact: true }),
  ).toBeVisible();

  await expect.poll(
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
      ).not.toHaveLength(0);

    const messagesResponse = await request.get(
      `${mailpitUrl}/api/v1/messages`,
    );

    const { messages } = await messagesResponse.json();

    const detailResponse = await request.get(
      `${mailpitUrl}/api/v1/message/${messages[0].ID}`,
    );

    expect(detailResponse.ok()).toBeTruthy();

    const email = await detailResponse.json();

    expect(email.HTML).toContain("Severe peanut allergy");
});

test("@email cancelling booking confirmation creates no booking", async ({
  page,
  request,
}) => {
  let bookingRequests = 0;

  page.on("request", (req) => {
    if (
      req.url().includes("/api/bookings") &&
      req.method() === "POST"
    ) {
      bookingRequests++;
    }
  });

  await openBookingFromSearch(page);

  await page
    .getByRole("button", { name: "Confirm booking" })
    .click();

  // Confirmation dialog really opened.
  await expect(
    page.getByRole("heading", { name: "Confirm your booking" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Cancel" })
    .click();

  // Dialog closes.
  await expect(
    page.getByRole("heading", { name: "Confirm your booking" }),
  ).not.toBeVisible();

  // The booking form is still available.
  await expect(
    page.getByRole("button", { name: "Confirm booking" }),
  ).toBeVisible();

  // No booking request must have been sent.
  expect(bookingRequests).toBe(0);

  // Therefore no confirmation email should exist either.
  const messagesResponse = await request.get(
    `${mailpitUrl}/api/v1/messages`,
  );

  expect(messagesResponse.ok()).toBeTruthy();

  const { messages } = await messagesResponse.json();

  expect(messages ?? []).toHaveLength(0);
});