import { test, expect } from "./fixtures.js";

function dateAfter(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function tomorrowDate() {
    return dateAfter(1);
}

async function loginAsEmployee(page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill("employee.demo@mountainhut.local");
    await page.getByLabel("Password", { exact: true }).fill("DemoEmployee123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

async function findAvailableTable(page) {
    await page.goto("/staff/bookings/new");
    await expect(page.getByRole("heading", { name: "Reserve for a hiker" })).toBeVisible();
    await page.getByLabel("Date").fill(tomorrowDate());
    await page.getByLabel("Arrival time").fill("12:00");
    await page.getByLabel("Number of people").selectOption("2");
    await page.getByRole("button", { name: "Check availability" }).click();
    await expect(page.getByRole("status")).toContainText("Available");
}

async function confirmStaffBooking(page) {
    const responsePromise = page.waitForResponse(
        (response) =>
            response.url().includes("/api/bookings/staff") &&
            response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Confirm staff booking" }).click();

    return responsePromise;
}

test("employee can book a table for an existing hiker", async ({ page }) => {
    await loginAsEmployee(page);
    await findAvailableTable(page);

    await page.getByLabel("Search by name, phone or email").fill("Demo Hiker");
    const hikerResult = page.getByRole("button", { name: /Demo Hiker/ });
    await hikerResult.waitFor();
    await hikerResult.click();

    const response = await confirmStaffBooking(page);
    expect(response.status()).toBe(201);
    const booking = await response.json();

    expect(booking).toMatchObject({
        hiker: {
            firstName: "Demo",
            lastName: "Hiker",
            isTemporary: false,
        },
        numberOfPeople: 2,
        status: "CONFIRMED",
    });

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText(`Booking reference: ${booking.id}`)).toBeVisible();
});

test("employee can create a hiker account and see its generated password", async ({ page }) => {
    await loginAsEmployee(page);
    await findAvailableTable(page);

    await page.getByRole("tab", { name: "New hiker account" }).click();
    await page.getByLabel("First name *").fill("E2E");
    await page.getByLabel("Last name *").fill("Hiker");
    await page.getByLabel("Email *").fill(`e2e.staff.${Date.now()}@mountainhut.local`);
    await page.getByLabel("Mobile number *").fill("3331234567");

    const response = await confirmStaffBooking(page);
    expect(response.status()).toBe(201);
    const booking = await response.json();

    expect(booking.hiker).toMatchObject({
        firstName: "E2E",
        lastName: "Hiker",
        isTemporary: false,
    });
    expect(booking.generatedPassword).toEqual(expect.any(String));
    expect(booking.generatedPassword.length).toBeGreaterThan(0);

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText("Temporary password for the hiker")).toBeVisible();
    await expect(page.locator(".staff-booking-secret code")).toHaveText(booking.generatedPassword);

    await page.getByRole("button", { name: "Create another booking" }).click();
    await expect(page.getByRole("heading", { name: "1. Find an available table" })).toBeVisible();
    await expect(page.locator(".staff-booking-secret")).toHaveCount(0);
});

test("employee can book for a quick-entry hiker without creating a login account", async ({ page }) => {
    await loginAsEmployee(page);
    await findAvailableTable(page);

    await page.getByRole("tab", { name: "Quick entry" }).click();
    const confirmButton = page.getByRole("button", { name: "Confirm staff booking" });
    await expect(confirmButton).toBeDisabled();
    await page.getByLabel("Name *").fill("E2E Walk-in");
    await expect(confirmButton).toBeEnabled();

    const response = await confirmStaffBooking(page);
    expect(response.status()).toBe(201);
    const booking = await response.json();

    expect(booking).toMatchObject({
        hiker: {
            firstName: "E2E Walk-in",
            lastName: "",
            email: null,
            phone: null,
            isTemporary: true,
        },
        numberOfPeople: 2,
        status: "CONFIRMED",
    });
    expect(booking.generatedPassword).toBeUndefined();

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText(`Booking reference: ${booking.id}`)).toBeVisible();
    await expect(page.locator(".staff-booking-secret")).toHaveCount(0);
});

test("employee can include an allergy in a staff booking", async ({ page }) => {
    await loginAsEmployee(page);
    await findAvailableTable(page);

    await page.getByRole("tab", { name: "Quick entry" }).click();
    await page.getByLabel("Name *").fill("E2E Allergy Guest");
    await page.getByRole("button", { name: "Add requirement" }).click();
    await expect(page.getByRole("heading", { name: "Add a requirement" })).toBeVisible();
    await page.getByLabel("Allergy or dietary requirement").fill("Severe peanut allergy");
    await page.getByLabel("This is an allergy").check();
    await page.getByRole("button", { name: "Save requirement" }).click();

    const requirement = page.locator("li.party-requirement");
    await expect(requirement).toContainText("Severe peanut allergy");
    await expect(requirement.locator(".requirement-type-badge")).toHaveText("Allergy");

    const response = await confirmStaffBooking(page);
    expect(response.status()).toBe(201);
    const booking = await response.json();
    expect(booking.dietaryRequirements).toEqual([
        { allergies: true, description: "Severe peanut allergy" },
    ]);
});

test("employee cannot continue to hiker details when no table is available", async ({ page }) => {
    await loginAsEmployee(page);

    await page.goto("/staff/bookings/new");
    await page.getByLabel("Date").fill(dateAfter(30));
    await page.getByLabel("Arrival time").fill("12:00");
    await page.getByLabel("Number of people").selectOption("2");
    await page.getByRole("button", { name: "Check availability" }).click();

    await expect(page.getByRole("status")).toContainText(
        "No suitable table is available. Try another time or date.",
    );
    await expect(page.getByRole("heading", { name: "2. Hiker information" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm staff booking" })).toHaveCount(0);
});

test("employee cannot create a duplicate booking for the same hiker and slot", async ({ page }) => {
    await loginAsEmployee(page);
    await findAvailableTable(page);

    const email = `e2e.duplicate.${Date.now()}@mountainhut.local`;
    await page.getByRole("tab", { name: "New hiker account" }).click();
    await page.getByLabel("First name *").fill("E2E Duplicate");
    await page.getByLabel("Last name *").fill("Hiker");
    await page.getByLabel("Email *").fill(email);
    await page.getByLabel("Mobile number *").fill("3331234567");

    const firstResponse = await confirmStaffBooking(page);
    expect(firstResponse.status()).toBe(201);

    await page.getByRole("button", { name: "Create another booking" }).click();
    await findAvailableTable(page);
    await page.getByLabel("Search by name, phone or email").fill(email);
    const hikerResult = page.getByRole("button", { name: new RegExp(email) });
    await hikerResult.waitFor();
    await hikerResult.click();

    const duplicateResponse = await confirmStaffBooking(page);
    expect(duplicateResponse.status()).toBe(409);
    const error = await duplicateResponse.json();
    expect(error.error).toBe("Hiker already has a booking for this slot");
    await expect(page.getByRole("alert")).toHaveText(
        "This slot is no longer available or conflicts with an existing booking. Check availability again.",
    );
});
