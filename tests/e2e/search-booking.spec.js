import { test, expect } from "./fixtures.js";

function tomorrowDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

test("public search can continue through login to booking", async ({ page }) => {
    const date = tomorrowDate();

    await page.goto("/search");

    await page.getByLabel("YOUR DATE").fill(date);
    await page.getByLabel("ARRIVAL TIME").fill("12:00");
    await page.getByLabel("YOUR PARTY").selectOption("2");
    await page.getByRole("button", { name: /FIND A TABLE/i }).click();

    await expect(page.getByRole("heading", { name: "A seat in the mountains." })).toBeVisible();
    await expect(page.getByText("AVAILABLE", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /CONTINUE TO BOOKING/i }).click();

    // Booking requires authentication.
    await expect(page).toHaveURL("/login");
    await page.getByLabel("Email").fill("hiker.demo@mountainhut.local");
    await page.getByLabel("Password", { exact: true }).fill("DemoHiker123");
    await page.getByRole("button", { name: "Login" }).click();

    // The availability state must survive the login redirect.
    await expect(page).toHaveURL("/booking");
    await expect(page.getByText(date, { exact: true })).toBeVisible();
    await expect(page.getByText("2 people", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Your table has been reserved successfully. You will receive a confirmation email.")).toBeVisible();
});

test("search with no available slot cannot continue to booking", async ({ page }) => {
    const date = new Date();
    date.setDate(date.getDate() + 30);

    const unavailableDate = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");

    await page.goto("/search");

    await page.getByLabel("YOUR DATE").fill(unavailableDate);
    await page.getByLabel("ARRIVAL TIME").fill("12:00");
    await page.getByLabel("YOUR PARTY").selectOption("2");
    await page.getByRole("button", { name: /FIND A TABLE/i }).click();

    await expect(page.getByText("UNAVAILABLE", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not this time." })).toBeVisible();
    await expect(page.getByRole("heading", {name: "No table found for this search."})).toBeVisible();

    // An unavailable search must never allow the user to book.
    await expect(page.getByRole("button", { name: /CONTINUE TO BOOKING/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ADJUST YOUR SEARCH/i })).toBeVisible();
});

test("booking shows the full service slot duration for a time inside the slot", async ({ page }) => {
  const date = tomorrowDate();

  // Login first: this test focuses on the slot duration regression.
  await page.goto("/login");
  await page.getByLabel("Email").fill("hiker.demo@mountainhut.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoHiker123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL("/");

  // Search inside the 12:00-14:00 lunch slot.
  await page.goto("/search");

  await page.getByLabel("YOUR DATE").fill(date);
  await page.getByLabel("ARRIVAL TIME").fill("13:30");
  await page.getByLabel("YOUR PARTY").selectOption("2");
  await page.getByRole("button", { name: /FIND A TABLE/i }).click();

  await expect(page.getByText("AVAILABLE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /CONTINUE TO BOOKING/i }).click();
  await expect(page).toHaveURL("/booking");

  // Regression: the real slot is 12:00-14:00, not 12:00-13:00.
  const serviceSlot = page.getByText("Service slot", { exact: true }).locator("..").locator("dd");

  await expect(serviceSlot).toHaveText(/12:00\s*-\s*14:00/);
});