import { test, expect } from "./fixtures.js";

async function loginAsWarden(page) {
    await page.goto("/login");

    await page.getByLabel("Email").fill("warden.demo@mountainhut.local");

    await page.getByLabel("Password").fill("DemoWarden123");

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/");
}

test("warden can create and update a slot", async ({ page }) => {
  await loginAsWarden(page);

  await page.goto("/staff/slots");

  // Create a new slot
  await page.getByLabel("Date").fill("2099-12-31");
  await page.getByLabel("Start time").fill("19:30");
  await page.getByLabel("Duration (minutes)").fill("90");
  await page.getByLabel("Meal").selectOption("DINNER");
  await page.getByLabel("Total capacity (seats)").fill("12");
  await page.getByLabel("Status").selectOption("OPEN");

  await page.getByRole("button", { name: "Add slot" }).click();

  await expect(page.getByRole("status")).toHaveText("Slot created.");

  const slotRow = page.getByRole("row").filter({ hasText: "2099-12-31" });

  await expect(slotRow).toContainText("19:30");
  await expect(slotRow).toContainText("90");
  await expect(slotRow).toContainText("DINNER");
  await expect(slotRow).toContainText("12");
  await expect(slotRow).toContainText("OPEN");

  // Edit the same slot
  await slotRow.getByRole("button", { name: "Edit" }).click();

  await page.getByLabel("Total capacity (seats)").fill("14");

  await page.getByLabel("Status").selectOption("CLOSED");

  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("status")).toHaveText("Slot updated.");

  const updatedRow = page.getByRole("row").filter({ hasText: "2099-12-31" });

  await expect(updatedRow).toContainText("14");
  await expect(updatedRow).toContainText("CLOSED");
});

test("slot form validates required fields", async ({ page }) => {
  await loginAsWarden(page);

  await page.goto("/staff/slots");

  await page.getByRole("button", { name: "Add slot" }).click();

  await expect(page.getByText("Date is required.", { exact: true })).toBeVisible();

  await page.getByLabel("Date").fill("2099-12-31");

  await page.getByRole("button", { name: "Add slot" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Start time is required." })).toHaveText("Start time is required.");
});


test("slot form rejects invalid duration", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    await page.getByLabel("Date").fill("2099-12-31");
    await page.getByLabel("Start time").fill("19:30");
    await page.getByLabel("Duration (minutes)").fill("0");
    await page.getByLabel("Total capacity (seats)").fill("10");

    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(page.getByText("Duration must be a whole number of minutes (at least 1).", { exact: true })).toBeVisible();
});


test("slot form rejects invalid capacity", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    await page.getByLabel("Date").fill("2099-12-31");
    await page.getByLabel("Start time").fill("19:30");
    await page.getByLabel("Duration (minutes)").fill("60");
    await page.getByLabel("Total capacity (seats)").fill("0");

    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(page.getByText("Total capacity must be a whole number (at least 1).", { exact: true })).toBeVisible();
});

async function loginAsEmployee(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("employee.demo@mountainhut.local");
  await page.getByLabel("Password").fill("DemoEmployee123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL("/");
}

test("employee can create a slot", async ({ page }) => {
    await loginAsEmployee(page);

    await page.goto("/staff/slots");

    await page.getByLabel("Date").fill("2099-12-29");
    await page.getByLabel("Start time").fill("12:30");
    await page.getByLabel("Duration (minutes)").fill("60");
    await page.getByLabel("Meal").selectOption("LUNCH");
    await page.getByLabel("Total capacity (seats)").fill("8");
    await page.getByLabel("Status").selectOption("OPEN");

    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(page.getByRole("status")).toHaveText("Slot created.");

    const slotRow = page.getByRole("row").filter({ hasText: "2099-12-29" });

    await expect(slotRow).toContainText("12:30");
    await expect(slotRow).toContainText("LUNCH");
    await expect(slotRow).toContainText("8");
    await expect(slotRow).toContainText("OPEN");
});

test("cancelling slot edit does not save changes", async ({ page }) => {
    await loginAsWarden(page);

    let updateRequests = 0;

    page.on("request", (request) => {
        if (
        request.url().includes("/api/slots/") &&
        request.method() === "PUT"
        ) {
        updateRequests++;
        }
    });

    await page.goto("/staff/slots");

    // Create a slot dedicated to this test.
    await page.getByLabel("Date").fill("2099-12-28");
    await page.getByLabel("Start time").fill("18:30");
    await page.getByLabel("Duration (minutes)").fill("60");
    await page.getByLabel("Meal").selectOption("DINNER");
    await page.getByLabel("Total capacity (seats)").fill("12");
    await page.getByLabel("Status").selectOption("OPEN");

    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(page.getByRole("status")).toHaveText("Slot created.");

    const slotRow = page.getByRole("row").filter({ hasText: "2099-12-28" });

    await expect(slotRow).toContainText("12");
    await expect(slotRow).toContainText("OPEN");

    // Start editing it.
    await slotRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: "Edit the slot" })).toBeVisible();

    // Change values, but do not save.
    await page.getByLabel("Total capacity (seats)").fill("99");

    await page.getByLabel("Status").selectOption("CLOSED");

    await page.getByRole("button", { name: "Cancel" }).click();

    // Editing mode must be closed.
    await expect(page.getByRole("heading", { name: "Add a slot" })).toBeVisible();

    // Original values must still be displayed.
    await expect(slotRow).toContainText("12");
    await expect(slotRow).toContainText("OPEN");

    // Most importantly: no update reached the backend.
    expect(updateRequests).toBe(0);
});