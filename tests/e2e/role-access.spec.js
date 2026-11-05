import { test, expect } from "./fixtures.js";

async function login(page, email, password) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

test("hiker cannot access staff pages", async ({ page }) => {
    await login(
        page,
        "hiker.demo@mountainhut.local",
        "DemoHiker123",
    );

    await page.goto("/staff/slots");
    await expect(page).toHaveURL("/");

    await page.goto("/admin/staff/new");
    await expect(page).toHaveURL("/");
});

test("employee can access staff slots but not warden administration", async ({ page }) => {
    await login(
        page,
        "employee.demo@mountainhut.local",
        "DemoEmployee123",
    );

    await page.goto("/staff/slots");
    await expect(page).toHaveURL("/staff/slots");
    await expect(page.getByRole("heading", { name: "Staff interface" })).toBeVisible();

    await page.goto("/admin/staff/new");
    await expect(page).toHaveURL("/");
});

test("warden can access staff and administration pages", async ({ page }) => {
    await login(
        page,
        "warden.demo@mountainhut.local",
        "DemoWarden123",
    );

    await page.goto("/staff/slots");
    await expect(page).toHaveURL("/staff/slots");
    await expect(page.getByRole("heading", { name: "Staff interface" })).toBeVisible();

    await page.goto("/admin/staff/new");
    await expect(page).toHaveURL("/admin/staff/new");
    await expect(page.getByRole("heading", { name: "Add Staff Member" })).toBeVisible();
});

test("hiker cannot call staff-only APIs directly", async ({ page }) => {
    await login(
        page,
        "hiker.demo@mountainhut.local",
        "DemoHiker123",
    );

    const slotResponse = await page.request.post(
        "http://localhost:3000/api/slots",
        {
            data: {
                date: "2099-12-27",
                startTime: "19:00",
                durationMinutes: 60,
                meal: "DINNER",
                totalCapacity: 10,
                status: "OPEN",
            },
        },
    );

    expect(slotResponse.status()).toBe(403);

    const staffResponse = await page.request.post(
        "http://localhost:3000/api/admin/staff",
        {
            data: {
                firstName: "Unauthorized",
                lastName: "User",
                email: "unauthorized@mountainhut.local",
                password: "Employee123",
                role: "EMPLOYEE",
            },
        },
    );

    expect(staffResponse.status()).toBe(403);

    const tableResponse = await page.request.post(
        "http://localhost:3000/api/tables",
        {
            data: {
                number: 999,
                seats: 4,
            },
        },
    );

    expect(tableResponse.status()).toBe(403);
});