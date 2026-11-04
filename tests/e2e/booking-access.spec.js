import { test, expect } from "./fixtures.js";

test("unauthenticated user cannot access the booking page", async ({ page }) => {
    await page.goto("/booking");

    await expect(page).toHaveURL("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
});

test("hiker cannot start a booking without selected availability", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("hiker.demo@mountainhut.local");
    await page.getByLabel("Password").fill("DemoHiker123");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/");

    await page.goto("/booking");
    await expect(page.getByText("Check availability before starting a booking.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
});