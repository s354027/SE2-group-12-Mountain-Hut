import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, expect } from "./fixtures.js";

const execFileAsync = promisify(execFile);

const HIKER = { email: "hiker.demo@mountainhut.local", password: "DemoHiker123" };
const EMPLOYEE = { email: "employee.demo@mountainhut.local", password: "DemoEmployee123" };

// Seed: 7 tables, 28 seats per slot; LUNCH at 12:00 and DINNER at 19:00.
const SLOT_CAPACITY = 28;
const LUNCH_TIME = "12:15";
const DINNER_TIME = "19:15";

function dateInDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

async function login(page, { email, password }) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

async function getCurrentUserId(page) {
    const response = await page.request.get("/api/auth/me");
    expect(response.ok()).toBeTruthy();

    return (await response.json()).id;
}

async function checkAvailability(request, { date, startTime, partySize }) {
    const query = new URLSearchParams({ date, startTime, partySize: String(partySize) });
    const response = await request.get(`/api/availability?${query}`);
    expect(response.ok()).toBeTruthy();

    return response.json();
}

// Creates a booking with the session of the given request context
// (page.request shares the cookies of the logged-in browser page).
async function createBookingViaApi(
    request,
    { date, startTime, partySize, dietaryRequirements = [] },
) {
    const availability = await checkAvailability(request, { date, startTime, partySize });
    expect(availability.available).toBe(true);

    const response = await request.post("/api/bookings", {
        data: {
            slotId: availability.slotId,
            numberOfPeople: partySize,
            dietaryRequirements,
        },
    });
    expect(response.status()).toBe(201);

    const booking = await response.json();
    expect(booking.status).toBe("CONFIRMED");

    return booking;
}

async function readBookingFromDb(bookingId) {
    const { stdout } = await execFileAsync(
        process.execPath,
        ["scripts/get-e2e-booking.js", String(bookingId)],
        { cwd: "backend" },
    );

    return JSON.parse(stdout);
}

function bookingCards(page) {
    return page.locator("article.hiker-booking-card");
}

function bookingCard(page, meal) {
    return bookingCards(page).filter({
        has: page.getByRole("heading", { name: meal, exact: true }),
    });
}

function cancelDialog(page) {
    return page.getByRole("dialog", { name: "Cancel booking?" });
}

async function openBookingsPage(page, expectedCards = 1) {
    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: "Your Bookings" })).toBeVisible();
    await expect(bookingCards(page)).toHaveCount(expectedCards);
}

async function openCancelDialog(card, page) {
    await card.getByRole("button", { name: "Cancel booking", exact: true }).click();

    const dialog = cancelDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
        "Are you sure you want to cancel this booking? This action cannot be undone.",
    );

    return dialog;
}

async function confirmCancellation(page) {
    const responsePromise = page.waitForResponse(
        (response) =>
            /\/api\/hikers\/\d+\/bookings\/\d+\/cancel$/.test(response.url()) &&
            response.request().method() === "PATCH",
    );

    await cancelDialog(page).getByRole("button", { name: "Confirm cancellation" }).click();

    const response = await responsePromise;

    return { status: response.status(), body: await response.json() };
}

async function expectCardStatus(card, status) {
    await expect(card).toHaveAttribute("data-status", status);
    await expect(card.locator(".hiker-booking-status")).toHaveText(status);
}

async function expectNoActions(card) {
    await expect(card.getByRole("button", { name: "Cancel booking", exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Modify booking" })).toHaveCount(0);
}

test.describe("hiker cancels a booking", () => {
    test.beforeEach(async ({ page }) => {
        await login(page, HIKER);
    });

    test("hiker cancels a booking from the bookings page", async ({ page }) => {
        const booking = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: DINNER_TIME,
            partySize: 3,
            dietaryRequirements: [{ allergies: true, description: "1 peanut allergy" }],
        });
        const hikerId = await getCurrentUserId(page);

        await openBookingsPage(page);

        const card = bookingCard(page, "DINNER");
        await expectCardStatus(card, "CONFIRMED");
        await expect(card).toContainText("1 peanut allergy");

        await openCancelDialog(card, page);
        const { status, body } = await confirmCancellation(page);

        expect(status).toBe(200);
        expect(body).toMatchObject({
            id: booking.id,
            hikerId,
            slotId: booking.slotId,
            numberOfPeople: 3,
            status: "CANCELLED",
        });

        // The dialog closes and the card reflects the cancellation.
        await expect(cancelDialog(page)).toHaveCount(0);
        await expectCardStatus(card, "CANCELLED");
        await expectNoActions(card);

        // The cancellation is persisted.
        await page.reload();
        await expect(bookingCards(page)).toHaveCount(1);
        await expectCardStatus(bookingCard(page, "DINNER"), "CANCELLED");
        await expectNoActions(bookingCard(page, "DINNER"));

        const stored = await readBookingFromDb(booking.id);
        expect(stored.status).toBe("CANCELLED");
        expect(stored.numberOfPeople).toBe(3);
    });

    test("there is no time constraint: a booking within 48 hours can still be cancelled", async ({ page }) => {
        // Tomorrow is inside the 48h window in which changes (MH-06) are no
        // longer admitted, but cancellation (MH-08) is always possible.
        const booking = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: LUNCH_TIME,
            partySize: 2,
        });

        await openBookingsPage(page);

        const card = bookingCard(page, "LUNCH");
        await expect(card.getByRole("button", { name: "Modify booking" })).toHaveCount(0);
        await expect(card.getByRole("button", { name: "Cancel booking", exact: true })).toBeVisible();

        await openCancelDialog(card, page);
        const { status, body } = await confirmCancellation(page);

        expect(status).toBe(200);
        expect(body.status).toBe("CANCELLED");
        await expectCardStatus(card, "CANCELLED");

        expect((await readBookingFromDb(booking.id)).status).toBe("CANCELLED");
    });

    test("a booking further in the future can also be cancelled", async ({ page }) => {
        const booking = await createBookingViaApi(page.request, {
            date: dateInDays(4),
            startTime: DINNER_TIME,
            partySize: 4,
        });

        await openBookingsPage(page);

        const card = bookingCard(page, "DINNER");
        await expect(card.getByRole("button", { name: "Modify booking" })).toBeVisible();
        await expect(card.getByRole("button", { name: "Cancel booking", exact: true })).toBeVisible();

        await openCancelDialog(card, page);
        const { status, body } = await confirmCancellation(page);

        expect(status).toBe(200);
        expect(body.status).toBe("CANCELLED");
        await expectCardStatus(card, "CANCELLED");
        await expectNoActions(card);

        expect((await readBookingFromDb(booking.id)).status).toBe("CANCELLED");
    });

    test("closing the dialog without confirming keeps the booking", async ({ page }) => {
        const booking = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: DINNER_TIME,
            partySize: 2,
        });

        let cancelRequests = 0;
        page.on("request", (request) => {
            if (request.method() === "PATCH" && request.url().endsWith("/cancel")) {
                cancelRequests++;
            }
        });

        await openBookingsPage(page);
        const card = bookingCard(page, "DINNER");

        // "Keep booking" button.
        let dialog = await openCancelDialog(card, page);
        await dialog.getByRole("button", { name: "Keep booking" }).click();
        await expect(cancelDialog(page)).toHaveCount(0);

        // Close (X) button.
        dialog = await openCancelDialog(card, page);
        await dialog.getByRole("button", { name: "Close" }).click();
        await expect(cancelDialog(page)).toHaveCount(0);

        // Escape key.
        await openCancelDialog(card, page);
        await page.keyboard.press("Escape");
        await expect(cancelDialog(page)).toHaveCount(0);

        expect(cancelRequests).toBe(0);
        await expectCardStatus(card, "CONFIRMED");
        await expect(card.getByRole("button", { name: "Cancel booking", exact: true })).toBeVisible();

        expect((await readBookingFromDb(booking.id)).status).toBe("CONFIRMED");
    });

    test("cancelling releases the places so the slot can be booked again", async ({ page }) => {
        const date = dateInDays(1);

        // Fill the whole lunch slot.
        const booking = await createBookingViaApi(page.request, {
            date,
            startTime: LUNCH_TIME,
            partySize: SLOT_CAPACITY,
        });

        const full = await checkAvailability(page.request, {
            date,
            startTime: LUNCH_TIME,
            partySize: 2,
        });
        expect(full.available).toBe(false);

        await openBookingsPage(page);
        await openCancelDialog(bookingCard(page, "LUNCH"), page);
        const { status } = await confirmCancellation(page);
        expect(status).toBe(200);
        await expectCardStatus(bookingCard(page, "LUNCH"), "CANCELLED");

        // The seats are available again for other guests.
        const freed = await checkAvailability(page.request, {
            date,
            startTime: LUNCH_TIME,
            partySize: SLOT_CAPACITY,
        });
        expect(freed.available).toBe(true);
        expect(freed.slotId).toBe(booking.slotId);

        // The hiker can book the same slot again through the web interface
        // (the cancelled booking no longer counts for "one booking per slot").
        await page.goto("/search");
        await page.getByLabel("YOUR DATE").fill(date);
        await page.getByLabel("ARRIVAL TIME").fill(LUNCH_TIME);
        await page.getByLabel("YOUR PARTY").selectOption("2");
        await page.getByRole("button", { name: /FIND A TABLE/i }).click();
        await expect(page.getByText("AVAILABLE", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: /CONTINUE TO BOOKING/i }).click();
        await expect(page).toHaveURL("/booking");

        await page.getByRole("button", { name: "Confirm booking" }).click();
        await expect(page.getByRole("heading", { name: "Confirm your booking" })).toBeVisible();

        const responsePromise = page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/bookings") &&
                response.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Continue" }).click();
        const response = await responsePromise;

        expect(response.status()).toBe(201);
        const newBooking = await response.json();
        expect(newBooking.slotId).toBe(booking.slotId);
        await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();

        // The bookings page shows the cancelled booking and the new one.
        await openBookingsPage(page, 2);
        await expect(bookingCards(page).filter({ hasText: "CANCELLED" })).toHaveCount(1);
        await expect(bookingCards(page).filter({ hasText: "CONFIRMED" })).toHaveCount(1);
    });

    test("only the selected booking is cancelled", async ({ page }) => {
        const lunch = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: LUNCH_TIME,
            partySize: 2,
        });
        const dinner = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: DINNER_TIME,
            partySize: 5,
        });

        await openBookingsPage(page, 2);

        await openCancelDialog(bookingCard(page, "DINNER"), page);
        const { status, body } = await confirmCancellation(page);

        expect(status).toBe(200);
        expect(body.id).toBe(dinner.id);

        await expectCardStatus(bookingCard(page, "DINNER"), "CANCELLED");
        await expectCardStatus(bookingCard(page, "LUNCH"), "CONFIRMED");
        await expect(
            bookingCard(page, "LUNCH").getByRole("button", { name: "Cancel booking", exact: true }),
        ).toBeVisible();

        expect((await readBookingFromDb(dinner.id)).status).toBe("CANCELLED");
        expect((await readBookingFromDb(lunch.id)).status).toBe("CONFIRMED");
    });

    test("an error is shown when the booking is no longer active", async ({ page }) => {
        const booking = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: DINNER_TIME,
            partySize: 2,
        });
        const hikerId = await getCurrentUserId(page);

        await openBookingsPage(page);
        const card = bookingCard(page, "DINNER");
        const dialog = await openCancelDialog(card, page);

        // Meanwhile the booking is cancelled elsewhere (e.g. another tab).
        const background = await page.request.patch(
            `/api/hikers/${hikerId}/bookings/${booking.id}/cancel`,
        );
        expect(background.status()).toBe(200);

        const { status, body } = await confirmCancellation(page);

        expect(status).toBe(409);
        expect(body.error).toBe("Booking is not active");

        await expect(dialog.getByRole("alert")).toHaveText("Booking is not active");
        await dialog.getByRole("button", { name: "Keep booking" }).click();
        await expect(cancelDialog(page)).toHaveCount(0);

        // A second cancellation through the API is refused as well.
        const again = await page.request.patch(
            `/api/hikers/${hikerId}/bookings/${booking.id}/cancel`,
        );
        expect(again.status()).toBe(409);

        expect((await readBookingFromDb(booking.id)).status).toBe("CANCELLED");
    });
});

test.describe("cancellation access control", () => {
    test("unauthenticated users cannot cancel bookings", async ({ page }) => {
        await page.goto("/bookings");
        await expect(page).toHaveURL("/login");

        const response = await page.request.patch("/api/hikers/1/bookings/1/cancel");
        expect(response.status()).toBe(401);
    });

    test("a hiker cannot cancel another hiker's booking", async ({ page, playwright }) => {
        // A second hiker registers and books a table.
        const otherHiker = await playwright.request.newContext({
            baseURL: "http://localhost:5173",
        });

        try {
            const registration = await otherHiker.post("/api/auth/register", {
                data: {
                    firstName: "Other",
                    lastName: "Hiker",
                    email: `other.hiker.${Date.now()}@mountainhut.local`,
                    password: "OtherHiker123",
                    phone: "+390000000000",
                },
            });
            expect(registration.status()).toBe(201);
            const otherHikerId = (await registration.json()).id;

            const otherBooking = await createBookingViaApi(otherHiker, {
                date: dateInDays(1),
                startTime: DINNER_TIME,
                partySize: 2,
            });

            // The demo hiker tries to cancel it.
            await login(page, HIKER);
            const hikerId = await getCurrentUserId(page);

            const viaOwnPath = await page.request.patch(
                `/api/hikers/${hikerId}/bookings/${otherBooking.id}/cancel`,
            );
            expect(viaOwnPath.status()).toBe(403);
            expect((await viaOwnPath.json()).error).toBe("Cannot cancel another hiker booking");

            const viaOtherPath = await page.request.patch(
                `/api/hikers/${otherHikerId}/bookings/${otherBooking.id}/cancel`,
            );
            expect(viaOtherPath.status()).toBe(403);

            // The other hiker's booking is not visible to the demo hiker.
            await openBookingsPage(page, 0);
            await expect(page.getByText("You have no upcoming bookings.")).toBeVisible();

            expect((await readBookingFromDb(otherBooking.id)).status).toBe("CONFIRMED");
        } finally {
            await otherHiker.dispose();
        }
    });

    test("cancelling a non-existent booking returns 404", async ({ page }) => {
        await login(page, HIKER);
        const hikerId = await getCurrentUserId(page);

        const response = await page.request.patch(
            `/api/hikers/${hikerId}/bookings/999999/cancel`,
        );
        expect(response.status()).toBe(404);
        expect((await response.json()).error).toBe("Booking not found");
    });

    test("staff cannot use the hiker cancellation endpoint", async ({ page }) => {
        await login(page, HIKER);
        const booking = await createBookingViaApi(page.request, {
            date: dateInDays(1),
            startTime: DINNER_TIME,
            partySize: 2,
        });
        const hikerId = await getCurrentUserId(page);

        await page.request.post("/api/auth/logout");
        await login(page, EMPLOYEE);

        const response = await page.request.patch(
            `/api/hikers/${hikerId}/bookings/${booking.id}/cancel`,
        );
        expect(response.status()).toBe(403);

        expect((await readBookingFromDb(booking.id)).status).toBe("CONFIRMED");
    });
});
