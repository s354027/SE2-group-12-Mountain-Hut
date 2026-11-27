import { test, expect } from "./fixtures.js";

async function login(page, email, password) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

test("hiker sees the hiker homepage and can check availability", async ({ page }) => {
    await login(
        page,
        "hiker.demo@mountainhut.local",
        "DemoHiker123",
    );

    await expect(
        page.getByRole("heading", {
            name: "Ready for your next stop at the hut?",
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("link", { name: /Check availability/ }),
    ).toBeVisible();

    await expect(
        page.getByRole("link", { name: /Manage slots/ }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: /Check availability/ }).click();

    await expect(page).toHaveURL("/search");
});

test("employee sees the staff homepage and can manage slots", async ({ page }) => {
    await login(
        page,
        "employee.demo@mountainhut.local",
        "DemoEmployee123",
    );

    await expect(
        page.getByRole("heading", {
            name: "Manage hut operations",
        }),
    ).toBeVisible();

    await expect(
        page.getByRole("link", { name: /Add new staff/ }),
    ).toHaveCount(0);

    await page.locator('a.home-primary-link[href="/staff/slots"]').click();

    await expect(page).toHaveURL("/staff/slots");

    await expect(
        page.getByRole("heading", { name: "Staff interface" }),
    ).toBeVisible();
});

test("warden sees the warden homepage and administration actions", async ({ page }) => {
    await login(
        page,
        "warden.demo@mountainhut.local",
        "DemoWarden123",
    );

    await expect(
        page.getByRole("heading", {
            name: "Monitor hut operations",
        }),
    ).toBeVisible();

    await expect(
        page.locator('a.home-primary-link[href="/staff/slots"]'),
    ).toBeVisible();

    const addStaffLink = page.getByRole("link", {
        name: /Add new staff/,
    });

    await expect(addStaffLink).toBeVisible();

    await addStaffLink.click();

    await expect(page).toHaveURL("/admin/staff/new");
});