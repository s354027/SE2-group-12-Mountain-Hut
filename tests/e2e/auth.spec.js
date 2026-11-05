import { test, expect } from "./fixtures.js";

test("hiker can login and logout", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email").fill(
    "hiker.demo@mountainhut.local",
  );
  await page.getByLabel("Password").fill("DemoHiker123");

  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "Log out" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();

  await expect(
    page.getByRole("link", { name: "Log in" }),
  ).toBeVisible();

  // Session must really be gone.
  await page.goto("/booking");

  await expect(page).toHaveURL("/login");
});


test("login with invalid credentials is rejected", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("hiker.demo@mountainhut.local");
    await page.getByLabel("Password").fill("WrongPassword");

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/login");

    await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
});

test("authenticated session survives page reload", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("hiker.demo@mountainhut.local");

    await page.getByLabel("Password").fill("DemoHiker123");

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/");

    await page.reload();

    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

    await page.goto("/booking");

    await expect(page).toHaveURL("/booking");
});