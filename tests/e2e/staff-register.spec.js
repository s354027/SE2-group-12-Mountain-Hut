import { test, expect } from "./fixtures.js";

async function login(page, email, password) {
    await page.goto("/login");

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/");
}

test("warden can create a new employee", async ({ page }) => {
    await login(
        page,
        "warden.demo@mountainhut.local",
        "DemoWarden123",
    );

    await page.goto("/admin/staff/new");

    await page.getByLabel("Name *", { exact: true }).fill("E2E");
    await page.getByLabel("Last name *", { exact: true }).fill("Employee");
    await page.getByLabel("Email *", { exact: true }).fill("e2e.employee@mountainhut.local");
    await page.getByLabel("Password *", { exact: true }).fill("Employee123");
    await page.getByLabel("Confirm Password *", { exact: true }).fill("Employee123");
    await page.getByLabel("Phone number").fill("3331234567");

    await page.getByLabel("Role *").selectOption("EMPLOYEE");

    await page.getByRole("button", { name: "Create Staff User" }).click();

    await expect(page.getByText("Staff user E2E Employee (EMPLOYEE) created successfully!")).toBeVisible();

    // Verify that the created account really works.
    await page.getByRole("button", { name: "Logout" }).click();

    await login(
        page,
        "e2e.employee@mountainhut.local",
        "Employee123",
    );

    // Employee is allowed into staff pages.
    await page.goto("/staff/slots");

    await expect(page).toHaveURL("/staff/slots");
    await expect(page.getByRole("heading", { name: "Staff interface" })).toBeVisible();

    // But not into Warden-only administration.
    await page.goto("/admin/staff/new");

    await expect(page).toHaveURL("/");
});

test("warden cannot create staff with an existing email", async ({ page }) => {
  await login(
    page,
    "warden.demo@mountainhut.local",
    "DemoWarden123",
  );

  await page.goto("/admin/staff/new");
  await page.getByLabel("Name *", { exact: true }).fill("Duplicate");
  await page.getByLabel("Last name *", { exact: true }).fill("Employee");
  await page.getByLabel("Email *", { exact: true }).fill("employee.demo@mountainhut.local");
  await page.getByLabel("Password *", { exact: true }).fill("Employee123");
  await page.getByLabel("Confirm Password *", { exact: true }).fill("Employee123");
  await page.getByLabel("Role *").selectOption("EMPLOYEE");
  await page.getByRole("button", { name: "Create Staff User" }).click();

  await expect(page.getByRole("alert")).toHaveText("A user with this email is already registered");
  await expect(page).toHaveURL("/admin/staff/new");
});