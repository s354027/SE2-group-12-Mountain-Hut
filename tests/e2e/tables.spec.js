import { test, expect } from "./fixtures.js";

async function loginAsWarden(page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill("warden.demo@mountainhut.local");
    await page.getByLabel("Password", { exact: true }).fill("DemoWarden123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

test("warden can create, update and delete a table", async ({ page }) => {
    await loginAsWarden(page);
    await page.goto("/staff/slots");

    // CREATE
    await page.getByLabel("Table number").fill("99");
    await page.getByLabel("Seats", { exact: true }).fill("4");
    await page.getByRole("button", { name: "Add table" }).click();

    let tableCard = page.locator(".tables-manager-card").filter({ hasText: "Table 99" });

    await expect(tableCard).toBeVisible();
    await expect(tableCard).toContainText("4 seats available");

    // UPDATE
    await tableCard.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit table" })).toBeVisible();

    await page.getByLabel("Seats", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Save changes" }).click();

    tableCard = page.locator(".tables-manager-card").filter({ hasText: "Table 99" });

    await expect(tableCard).toContainText("6 seats available");

    // DELETE
    await tableCard.getByRole("button", { name: "Delete" }).click();
    await expect(tableCard).toHaveCount(0);
});

test("warden cannot delete a table assigned to a slot", async ({ page }) => {
    await loginAsWarden(page);
    await page.goto("/staff/slots");

    const tableCard = page.locator(".tables-manager-card").filter({has: page.getByText("Table 1", { exact: true })});

    await expect(tableCard).toBeVisible();

    const deleteResponsePromise = page.waitForResponse(
        (response) => response.url().includes("/api/tables/") &&response.request().method() === "DELETE",
    );

    await tableCard.getByRole("button", { name: "Delete" }).click();

    const deleteResponse = await deleteResponsePromise;

    // Backend integrity constraint.
    expect(deleteResponse.status()).toBe(400);

    // The frontend must explain why deletion failed.
    await expect(page.getByRole("alert")).toHaveText(/Cannot delete a table that is assigned to one or more slots/);

    // The table must still exist in the UI.
    await expect(tableCard).toBeVisible();
});



function tomorrowDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

test("updating table seats updates associated slot capacity", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    const date = tomorrowDate();

    // Seeded lunch slot: all tables -> total capacity 28.
    const slotRow = page.getByRole("row").filter({ hasText: date }).filter({ hasText: "12:00" });

    await expect(slotRow.getByRole("cell", { name: "28", exact: true })).toBeVisible();

    const tableCard = page.locator(".tables-manager-card").filter({has: page.getByText("Table 1", { exact: true })});

    await expect(tableCard).toContainText("2 seats available");

    // Table 1: 2 -> 3 seats.
    await tableCard.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Seats", { exact: true }).fill("3");
    await page.getByRole("button", { name: "Save changes" }).click();

    // TablesManager updated.
    await expect(tableCard).toContainText("3 seats available");

    // SlotsManager must reload automatically:
    // 28 - 2 + 3 = 29.
    await expect(slotRow.getByRole("cell", { name: "29", exact: true })).toBeVisible();

    // Restore seed value so this test does not pollute the others.
    await tableCard.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Seats", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(tableCard).toContainText("2 seats available");

    await expect(slotRow.getByRole("cell", { name: "28", exact: true })).toBeVisible();
});

function futureDate(daysFromNow = 2) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function loginAsHiker(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("hiker.demo@mountainhut.local");
  await page
    .getByLabel("Password", { exact: true })
    .fill("DemoHiker123");

  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL("/");
}

test("warden cannot reduce table seats below already booked seats", async ({ page }) => {
  const date = futureDate();

  await loginAsHiker(page);

  // Get a real available slot.
  const availability = await page.evaluate(async ({ date }) => {
    const response = await fetch(
      `/api/availability?date=${date}&startTime=12:00&partySize=2`,
      { credentials: "include" },
    );

    return {
      status: response.status,
      body: await response.json(),
    };
  }, { date });

  expect(availability.status).toBe(200);
  expect(availability.body.available).toBe(true);

  // Create a real booking.
  const booking = await page.evaluate(async ({ slotId }) => {
    const response = await fetch("/api/bookings", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slotId,
        numberOfPeople: 2,
        allergyFlag: false,
        allergyDescription: null,
      }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  }, { slotId: availability.body.slotId });

  expect(booking.status).toBe(201);
  expect(booking.body.tables).toHaveLength(1);

  const bookedTable = booking.body.tables[0];

  expect(bookedTable.allocatedSeats).toBe(2);

  // End hiker session.
  const logoutStatus = await page.evaluate(async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    return response.status;
  });

  expect(logoutStatus).toBe(204);

  // Login as warden.
  await loginAsWarden(page);

  await page.goto("/staff/slots");

  // Find the table that was actually assigned to the booking.
  const tableCard = page
    .locator(".tables-manager-card")
    .filter({
      has: page.getByText(
        `Table ${bookedTable.tableNumber}`,
        { exact: true },
      ),
    });

  await tableCard
    .getByRole("button", { name: "Edit" })
    .click();

  await page
    .getByLabel("Seats", { exact: true })
    .fill("1");

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/tables/") &&
      response.request().method() === "PUT",
  );

  await page
    .getByRole("button", { name: "Save changes" })
    .click();

  const response = await responsePromise;

  expect(response.status()).toBe(409);

  await expect(
    page.getByRole("alert"),
  ).toContainText("Cannot reduce seats to 1");

  await expect(
    page.getByRole("alert"),
  ).toContainText("already has 2 seats booked at this table");
});