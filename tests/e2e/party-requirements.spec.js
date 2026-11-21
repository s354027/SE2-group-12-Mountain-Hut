// MH-65 — E2E tests for MH-05 "Provide party requirements" (happy path).
//
// A hiker books a table and specifies a list of requirements for subsets of
// the party, each with its own allergies flag and description. The tests
// check that the booking is created and that the requirements are stored
// correctly (API response and E2E database).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, expect } from "./fixtures.js";

const execFileAsync = promisify(execFile);

const RESERVED_MESSAGE =
    "Your table has been reserved successfully. You will receive a confirmation email.";

function tomorrowDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);

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

async function openBooking(page, partySize) {
    await page.goto("/search");

    await page.getByLabel("YOUR DATE").fill(tomorrowDate());
    await page.getByLabel("ARRIVAL TIME").fill("19:15");
    await page.getByLabel("YOUR PARTY").selectOption(String(partySize));
    await page.getByRole("button", { name: /FIND A TABLE/i }).click();

    await expect(page.getByText("AVAILABLE", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /CONTINUE TO BOOKING/i }).click();

    await expect(page).toHaveURL("/booking");
    await expect(page.getByRole("heading", { name: "Party requirements" })).toBeVisible();
}

async function addRequirement(page, description, { allergy = false } = {}) {
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const modalTitle = page.getByRole("heading", { name: "Add a requirement" });
    await expect(modalTitle).toBeVisible();

    const descriptionField = page.getByLabel("Allergy or dietary requirement");
    const allergyCheckbox = page.getByLabel("This is an allergy");

    // A new requirement starts from an empty form (wait for the reset,
    // the modal keeps the previous values for one render).
    await expect(descriptionField).toHaveValue("");
    await expect(allergyCheckbox).not.toBeChecked();

    await descriptionField.fill(description);

    if (allergy) {
        await allergyCheckbox.check();
        await expect(allergyCheckbox).toBeChecked();
    }

    await page.getByRole("button", { name: "Save requirement" }).click();
    await expect(modalTitle).not.toBeVisible();
}

function requirementItem(page, description) {
    return page.locator("li.party-requirement").filter({
        has: page.locator(".requirement-description", { hasText: description }),
    });
}

async function expectRequirementBadge(page, description, badge) {
    const item = requirementItem(page, description);

    await expect(item).toHaveCount(1);
    await expect(item.locator(".requirement-description")).toHaveText(description);
    await expect(item.locator(".requirement-type-badge")).toHaveText(badge);
}

async function confirmBooking(page) {
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "Confirm your booking" })).toBeVisible();

    const responsePromise = page.waitForResponse(
        (response) =>
            response.url().includes("/api/bookings") &&
            response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Continue" }).click();

    const response = await responsePromise;

    return {
        requestBody: response.request().postDataJSON(),
        status: response.status(),
        body: await response.json(),
    };
}

async function readBookingFromDb(bookingId) {
    const { stdout } = await execFileAsync(
        process.execPath,
        ["scripts/get-e2e-booking.js", String(bookingId)],
        { cwd: "backend" },
    );

    return JSON.parse(stdout);
}

async function expectBookingConfirmedPage(page) {
    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText(RESERVED_MESSAGE)).toBeVisible();
    await expect(page.getByText("Your specified party requirements.")).toBeVisible();

    // Once confirmed, requirements are shown read-only.
    await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit requirement:/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Remove requirement:/ })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
    await loginAsHiker(page);
});

test("hiker books a table with multiple requirements for subsets of the party", async ({ page }) => {
    // Example taken from the MH-05 clarifications.
    const expectedRequirements = [
        { allergies: true, description: "1 vegan, peanut allergy" },
        { allergies: true, description: "1 shellfish allergy" },
        { allergies: false, description: "2 vegetarians" },
    ];

    await openBooking(page, 4);

    for (const requirement of expectedRequirements) {
        await addRequirement(page, requirement.description, {
            allergy: requirement.allergies,
        });
    }

    await expect(page.locator("li.party-requirement")).toHaveCount(3);
    await expectRequirementBadge(page, "1 vegan, peanut allergy", "Allergy");
    await expectRequirementBadge(page, "1 shellfish allergy", "Allergy");
    await expectRequirementBadge(page, "2 vegetarians", "Diet");

    const { requestBody, status, body } = await confirmBooking(page);

    // The frontend sends the full list, in order.
    expect(requestBody.numberOfPeople).toBe(4);
    expect(requestBody.dietaryRequirements).toEqual(expectedRequirements);

    // The booking is created with the requirements.
    expect(status).toBe(201);
    expect(body.id).toEqual(expect.any(Number));
    expect(body.status).toBe("CONFIRMED");
    expect(body.numberOfPeople).toBe(4);
    expect(body.dietaryRequirements).toEqual(expectedRequirements);

    await expectBookingConfirmedPage(page);
    await expect(page.locator("li.party-requirement")).toHaveCount(3);
    await expectRequirementBadge(page, "1 vegan, peanut allergy", "Allergy");
    await expectRequirementBadge(page, "1 shellfish allergy", "Allergy");
    await expectRequirementBadge(page, "2 vegetarians", "Diet");

    // The requirements are persisted in the database.
    const stored = await readBookingFromDb(body.id);

    expect(stored).not.toBeNull();
    expect(stored.status).toBe("CONFIRMED");
    expect(stored.numberOfPeople).toBe(4);
    expect(stored.dietaryRequirements).toEqual(expectedRequirements);
});

test("hiker books a table with a single dietary requirement", async ({ page }) => {
    const expectedRequirements = [
        { allergies: false, description: "Vegetarian menu" },
    ];

    await openBooking(page, 2);
    await addRequirement(page, "Vegetarian menu");

    await expectRequirementBadge(page, "Vegetarian menu", "Diet");

    const { status, body } = await confirmBooking(page);

    expect(status).toBe(201);
    expect(body.status).toBe("CONFIRMED");
    expect(body.numberOfPeople).toBe(2);
    expect(body.dietaryRequirements).toEqual(expectedRequirements);

    await expectBookingConfirmedPage(page);
    await expectRequirementBadge(page, "Vegetarian menu", "Diet");

    const stored = await readBookingFromDb(body.id);

    expect(stored.status).toBe("CONFIRMED");
    expect(stored.numberOfPeople).toBe(2);
    expect(stored.dietaryRequirements).toEqual(expectedRequirements);
});

test("hiker books a table with an allergy requirement and its description", async ({ page }) => {
    const description = "Severe gluten allergy (coeliac)";
    const expectedRequirements = [{ allergies: true, description }];

    await openBooking(page, 2);
    await addRequirement(page, description, { allergy: true });

    await expectRequirementBadge(page, description, "Allergy");

    const { requestBody, status, body } = await confirmBooking(page);

    expect(requestBody.dietaryRequirements).toEqual(expectedRequirements);
    expect(status).toBe(201);
    expect(body.status).toBe("CONFIRMED");
    expect(body.dietaryRequirements).toEqual(expectedRequirements);

    await expectBookingConfirmedPage(page);
    await expectRequirementBadge(page, description, "Allergy");

    const stored = await readBookingFromDb(body.id);

    expect(stored.status).toBe("CONFIRMED");
    expect(stored.dietaryRequirements).toEqual(expectedRequirements);
});

test("requirements edited before confirming are saved in their final version", async ({ page }) => {
    const expectedRequirements = [
        { allergies: true, description: "Lactose intolerance" },
        { allergies: false, description: "1 child menu" },
    ];

    await openBooking(page, 3);

    // Surrounding whitespace is trimmed.
    await addRequirement(page, "  Lactose intolerance  ");
    await expectRequirementBadge(page, "Lactose intolerance", "Diet");

    // Edit it to flag the allergy.
    await page.getByRole("button", { name: "Edit requirement: Lactose intolerance" }).click();
    await expect(page.getByRole("heading", { name: "Edit requirement" })).toBeVisible();
    await expect(page.getByLabel("Allergy or dietary requirement")).toHaveValue("Lactose intolerance");
    await expect(page.getByLabel("This is an allergy")).not.toBeChecked();
    await page.getByLabel("This is an allergy").check();
    await page.getByRole("button", { name: "Save requirement" }).click();
    await expect(page.getByRole("heading", { name: "Edit requirement" })).not.toBeVisible();

    await expectRequirementBadge(page, "Lactose intolerance", "Allergy");

    // Add a requirement and then remove it.
    await addRequirement(page, "No pork");
    await expectRequirementBadge(page, "No pork", "Diet");
    await page.getByRole("button", { name: "Remove requirement: No pork" }).click();
    await expect(requirementItem(page, "No pork")).toHaveCount(0);

    await addRequirement(page, "1 child menu");
    await expect(page.locator("li.party-requirement")).toHaveCount(2);

    const { requestBody, status, body } = await confirmBooking(page);

    expect(requestBody.dietaryRequirements).toEqual(expectedRequirements);
    expect(status).toBe(201);
    expect(body.numberOfPeople).toBe(3);
    expect(body.dietaryRequirements).toEqual(expectedRequirements);

    await expectBookingConfirmedPage(page);

    const stored = await readBookingFromDb(body.id);

    expect(stored.status).toBe("CONFIRMED");
    expect(stored.numberOfPeople).toBe(3);
    expect(stored.dietaryRequirements).toEqual(expectedRequirements);
});


test("hiker can book a table without party requirements", async ({ page }) => {
    await openBooking(page, 2);

    await expect(page.locator("li.party-requirement")).toHaveCount(0);

    const { requestBody, status, body } = await confirmBooking(page);

    expect(requestBody.dietaryRequirements).toEqual([]);

    expect(status).toBe(201);
    expect(body.status).toBe("CONFIRMED");
    expect(body.numberOfPeople).toBe(2);
    expect(body.dietaryRequirements).toEqual([]);

    await expectBookingConfirmedPage(page);
    await expect(page.locator("li.party-requirement")).toHaveCount(0);

    const stored = await readBookingFromDb(body.id);

    expect(stored.status).toBe("CONFIRMED");
    expect(stored.dietaryRequirements).toEqual([]);
});

test("empty party requirement cannot be saved", async ({ page }) => {
    await openBooking(page, 2);

    await page.getByRole("button", { name: "Add", exact: true }).click();

    const modalTitle = page.getByRole("heading", {
        name: "Add a requirement",
    });

    const descriptionField = page.getByLabel(
        "Allergy or dietary requirement",
    );

    const saveButton = page.getByRole("button", {
        name: "Save requirement",
    });

    await expect(modalTitle).toBeVisible();

    // Empty requirement.
    await expect(descriptionField).toHaveValue("");
    await expect(saveButton).toBeDisabled();

    // Whitespace-only requirement must still be invalid.
    await descriptionField.fill("   ");
    await expect(saveButton).toBeDisabled();

    await expect(page.locator("li.party-requirement")).toHaveCount(0);
});

test("canceling a new requirement discards unsaved data", async ({ page }) => {
    await openBooking(page, 2);

    await page.getByRole("button", { name: "Add", exact: true }).click();

    const modalTitle = page.getByRole("heading", {
        name: "Add a requirement",
    });

    const descriptionField = page.getByLabel(
        "Allergy or dietary requirement",
    );

    const allergyCheckbox = page.getByLabel("This is an allergy");

    await descriptionField.fill("Peanut allergy");
    await allergyCheckbox.check();

    await page.getByRole("button", {
        name: "Cancel",
        exact: true,
    }).click();

    await expect(modalTitle).not.toBeVisible();

    // Nothing was added.
    await expect(page.locator("li.party-requirement")).toHaveCount(0);

    // Reopening the modal must start from a clean state.
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(descriptionField).toHaveValue("");
    await expect(allergyCheckbox).not.toBeChecked();
});

test("canceling an edit keeps the original requirement unchanged", async ({ page }) => {
    await openBooking(page, 2);

    await addRequirement(page, "Vegetarian menu");
    await expectRequirementBadge(page, "Vegetarian menu", "Diet");

    await page
        .getByRole("button", { name: "Edit requirement: Vegetarian menu" })
        .click();

    const modalTitle = page.getByRole("heading", {
        name: "Edit requirement",
    });

    const descriptionField = page.getByLabel(
        "Allergy or dietary requirement",
    );

    const allergyCheckbox = page.getByLabel("This is an allergy");

    await descriptionField.fill("Peanut allergy");
    await allergyCheckbox.check();

    await page.getByRole("button", {
        name: "Cancel",
        exact: true,
    }).click();

    await expect(modalTitle).not.toBeVisible();

    // The original requirement must still be there unchanged.
    await expectRequirementBadge(page, "Vegetarian menu", "Diet");
    await expect(requirementItem(page, "Peanut allergy")).toHaveCount(0);

    const { requestBody, status, body } = await confirmBooking(page);

    expect(status).toBe(201);
    expect(requestBody.dietaryRequirements).toEqual([
        {
            allergies: false,
            description: "Vegetarian menu",
        },
    ]);

    expect(body.dietaryRequirements).toEqual([
        {
            allergies: false,
            description: "Vegetarian menu",
        },
    ]);

    const stored = await readBookingFromDb(body.id);

    expect(stored.dietaryRequirements).toEqual([
        {
            allergies: false,
            description: "Vegetarian menu",
        },
    ]);
});

test("removing the last requirement creates a booking with no requirements", async ({ page }) => {
    await openBooking(page, 2);

    await addRequirement(page, "Vegetarian menu");

    await expect(page.locator("li.party-requirement")).toHaveCount(1);

    await page
        .getByRole("button", {
            name: "Remove requirement: Vegetarian menu",
        })
        .click();

    await expect(page.locator("li.party-requirement")).toHaveCount(0);

    const { requestBody, status, body } = await confirmBooking(page);

    expect(status).toBe(201);
    expect(requestBody.dietaryRequirements).toEqual([]);
    expect(body.dietaryRequirements).toEqual([]);

    const stored = await readBookingFromDb(body.id);

    expect(stored.dietaryRequirements).toEqual([]);
});

test("party requirements are shown in the hiker bookings list after confirmation", async ({ page }) => {
    await openBooking(page, 2);

    await addRequirement(page, "Vegetarian menu");
    await addRequirement(page, "Peanut allergy", {
        allergy: true,
    });

    const { status } = await confirmBooking(page);

    expect(status).toBe(201);

    await expectBookingConfirmedPage(page);

    await page
        .getByRole("button", { name: "View your bookings" })
        .click();

    await expect(page).toHaveURL("/bookings");
    await expect(
        page.getByRole("heading", { name: "Your Bookings" }),
    ).toBeVisible();

    await expect(
        page.getByText("Dietary requirements", { exact: true }),
    ).toBeVisible();

    await expect(
        page.getByText(
            "Vegetarian menu, Peanut allergy",
            { exact: true },
        ),
    ).toBeVisible();
});

test("confirmed party requirements remain visible after page reload", async ({ page }) => {
    await openBooking(page, 2);

    await addRequirement(page, "Vegetarian menu");

    const { status } = await confirmBooking(page);
    expect(status).toBe(201);

    await expectBookingConfirmedPage(page);
    await expectRequirementBadge(
        page,
        "Vegetarian menu",
        "Diet",
    );

    await page.reload();

    await expect(
        page.getByRole("heading", {
            name: "Booking confirmed",
        }),
    ).toBeVisible();

    await expectRequirementBadge(
        page,
        "Vegetarian menu",
        "Diet",
    );
});