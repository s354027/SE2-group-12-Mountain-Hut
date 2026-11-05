import { test, expect } from "./fixtures.js";

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
    await page.getByLabel("Password", { exact: true }).fill("DemoHiker123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

async function searchAvailability(page, date) {
    await page.goto("/search");

    await page.getByLabel("YOUR DATE").fill(date);
    await page.getByLabel("ARRIVAL TIME").fill("12:00");
    await page.getByLabel("YOUR PARTY").selectOption("2");

    await page.getByRole("button", { name: /FIND A TABLE/i }).click();
    await expect(page.getByText("AVAILABLE", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /CONTINUE TO BOOKING/i }).click();
    await expect(page).toHaveURL("/booking");
}

test("hiker cannot book the same slot twice", async ({ page }) => {
    const date = futureDate();

    await loginAsHiker(page);

    // First booking
    await searchAvailability(page, date);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Your table has been reserved successfully. You will receive a confirmation email.")).toBeVisible();

    // Search for exactly the same slot again.
    await searchAvailability(page, date);
    await page.getByRole("button", { name: "Confirm booking" }).click();

    const responsePromise = page.waitForResponse(
        response => response.url().includes("/api/bookings") && response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Continue" }).click();

    const response = await responsePromise;

    expect(response.status()).toBe(409);

    await expect(page.getByRole("alert")).toHaveText("You already have a booking for this time slot.");
});