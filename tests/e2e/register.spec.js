import { test, expect } from "./fixtures.js";

test("new hiker can register successfully", async ({ page }) => {
  await page.goto("/register");

  await page.getByLabel("Name *", { exact: true }).fill("E2E");
  await page.getByLabel("Last name *", { exact: true }).fill("Hiker");
  await page.getByLabel("Email *", { exact: true }).fill(
    "e2e.hiker@mountainhut.local",
  );
  await page.getByLabel("Password *", { exact: true }).fill("Test123");
  await page.getByLabel("Confirm Password *", { exact: true }).fill("Test123");
  await page.getByLabel("Phone number *", { exact: true }).fill("3331234567");

  await page.getByRole("button", { name: "Register" }).click();

  await expect(page).toHaveURL("/");

  await expect(
    page.getByRole("button", { name: "Logout" }),
  ).toBeVisible();

  await page.goto("/booking");

  await expect(page).toHaveURL("/booking");
});

test("registration rejects mismatching passwords", async ({ page }) => {
  await page.goto("/register");

  await page.getByLabel("Name *", { exact: true }).fill("E2E");
  await page.getByLabel("Last name *", { exact: true }).fill("Hiker");
  await page.getByLabel("Email *", { exact: true }).fill("mismatch@mountainhut.local");
  await page.getByLabel("Password *", { exact: true }).fill("Test123");
  await page.getByLabel("Confirm Password *", { exact: true }).fill("Different123");
  await page.getByLabel("Phone number *", { exact: true }).fill("3331234567");

  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByRole("alert")).toHaveText("Passwords do not match");

  await expect(page).toHaveURL("/register");
});

test("registration rejects an already registered email", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Name *", { exact: true }).fill("Existing");
    await page.getByLabel("Last name *", { exact: true }).fill("Hiker");
    await page.getByLabel("Email *", { exact: true }).fill("hiker.demo@mountainhut.local");
    await page.getByLabel("Password *", { exact: true }).fill("Test123");
    await page.getByLabel("Confirm Password *", { exact: true }).fill("Test123");
    await page.getByLabel("Phone number *", { exact: true }).fill("3331234567");

    await page.getByRole("button", { name: "Register" }).click();

    await expect(page.getByRole("alert")).toHaveText("A user with this email is already registered");

    await expect(page).toHaveURL("/register");
});