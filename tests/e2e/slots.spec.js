import { test, expect } from "./fixtures.js";

async function loginAsWarden(page) {
    await page.goto("/login");

    await page.getByLabel("Email").fill("warden.demo@mountainhut.local");

    await page.getByLabel("Password", { exact: true }).fill("DemoWarden123");

    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL("/");
}

test("warden can create and update a slot", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    // CREATE
    await page.getByLabel("Date").fill("2099-12-31");
    await page.getByLabel("Start time").fill("19:30");
    await page.getByLabel("Duration (minutes)").fill("90");
    await page.getByLabel("Meal").selectOption("DINNER");
    await page.getByLabel("Status").selectOption("OPEN");

    // Open tables dropdown.
    await page.locator("details.slot-tables-dropdown > summary").click();

    // Table 1 = 2 seats
    const table1 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 1", { exact: true }),
    });

    // Table 3 = 4 seats
    const table3 = page.locator(".slot-table-option").filter({has: page.getByText("Table 3", { exact: true })});

    await table1.getByRole("checkbox").check();
    await table3.getByRole("checkbox").check();

    // 2 + 4 = 6
    await expect(page.getByText("Total capacity:").locator("..")).toContainText("6 seats");
    await page.getByRole("button", { name: "Add slot" }).click();
    await expect(page.getByRole("status")).toHaveText("Slot created.");

    let slotRow = page.getByRole("row").filter({ hasText: "2099-12-31" });

    await expect(slotRow).toContainText("19:30");
    await expect(slotRow).toContainText("90");
    await expect(slotRow).toContainText("DINNER");
    await expect(slotRow.getByRole("cell", { name: "6", exact: true })).toBeVisible();
    await expect(slotRow.getByRole("cell", { name: "1, 3", exact: true })).toBeVisible();
    await expect(slotRow).toContainText("OPEN");

    // UPDATE
    await slotRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: "Edit the slot" })).toBeVisible();

    // Open tables dropdown
    await page.locator("details.slot-tables-dropdown > summary").click();

    // Existing tables must already be selected.

    await expect(table1.getByRole("checkbox")).toBeChecked();
    await expect(table3.getByRole("checkbox")).toBeChecked();



    // Remove Table 1 (2 seats) and add Table 5 (6 seats).
    await table1.getByRole("checkbox").uncheck();

    const table5 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 5", { exact: true }),
    });

    await table5.getByRole("checkbox").check();

    // Table 3 + Table 5 = 4 + 6 = 10
    await expect(
        page.getByText("Total capacity:").locator(".."),
    ).toContainText("10 seats");

    await page
        .getByLabel("Status")
        .selectOption("CLOSED");

    await page
        .getByRole("button", { name: "Save changes" })
        .click();

    await expect(page.getByRole("status")).toHaveText("Slot updated.");

    slotRow = page.getByRole("row").filter({ hasText: "2099-12-31" });
    await expect(slotRow.getByRole("cell", { name: "10", exact: true })).toBeVisible();
    await expect(slotRow.getByRole("cell", { name: "3, 5", exact: true })).toBeVisible();
    await expect(slotRow).toContainText("CLOSED");
});

test("slot form validates required fields", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    await page.getByLabel("Date").fill("2099-12-30");
    await page.getByLabel("Start time").fill("12:30");
    await page.getByLabel("Duration (minutes)").fill("60");
    await page.getByLabel("Meal").selectOption("LUNCH");
    await page.getByLabel("Status").selectOption("OPEN");

    // Do not select any table.
    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(
        page.getByRole("alert").filter({
            hasText: "Select at least one table.",
        }),
    ).toHaveText("Select at least one table.");

    // Slot must not have been created.
    await expect(page.getByRole("row").filter({ hasText: "2099-12-30" })).toHaveCount(0);
});


test("slot form rejects invalid duration", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    await page.getByLabel("Date").fill("2099-12-31");
    await page.getByLabel("Start time").fill("19:30");
    await page.getByLabel("Duration (minutes)").fill("0");

    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(
        page.getByRole("alert").filter({
            hasText: "Duration must be a whole number of minutes (at least 1).",
        }),
    ).toHaveText("Duration must be a whole number of minutes (at least 1).");
});

async function loginAsEmployee(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("employee.demo@mountainhut.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoEmployee123");
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
    await page.getByLabel("Status").selectOption("OPEN");

    await page.locator("details.slot-tables-dropdown > summary").click();

    const table1 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 1", { exact: true }),
    });

    const table3 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 3", { exact: true }),
    });

    await table1.getByRole("checkbox").check();
    await table3.getByRole("checkbox").check();

    await expect(page.getByText("Total capacity:").locator("..")).toContainText("6 seats");
    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(page.getByRole("status")).toHaveText("Slot created.");

    const slotRow = page.getByRole("row").filter({ hasText: "2099-12-29" });

    await expect(slotRow).toContainText("12:30");
    await expect(slotRow).toContainText("60");
    await expect(slotRow).toContainText("LUNCH");

    await expect(slotRow.getByRole("cell", { name: "6", exact: true })).toBeVisible();
    await expect(slotRow.getByRole("cell", { name: "1, 3", exact: true })).toBeVisible();
    await expect(slotRow).toContainText("OPEN");
});

test("cancelling slot edit does not save changes", async ({ page }) => {
    await loginAsWarden(page);

    await page.goto("/staff/slots");

    // Create a slot dedicated to this test.
    await page.getByLabel("Date").fill("2099-12-28");
    await page.getByLabel("Start time").fill("18:30");
    await page.getByLabel("Duration (minutes)").fill("60");
    await page.getByLabel("Meal").selectOption("DINNER");
    await page.getByLabel("Status").selectOption("OPEN");

    await page.locator("details.slot-tables-dropdown > summary").click();

    const table1 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 1", { exact: true }),
    });

    const table3 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 3", { exact: true }),
    });

    const table5 = page.locator(".slot-table-option").filter({
        has: page.getByText("Table 5", { exact: true }),
    });

    await table1.getByRole("checkbox").check();
    await table3.getByRole("checkbox").check();

    await page.getByRole("button", { name: "Add slot" }).click();

    await expect(page.getByRole("status")).toHaveText("Slot created.");

    const slotRow = page.getByRole("row").filter({ hasText: "2099-12-28" });

    await expect(slotRow.getByRole("cell", { name: "6", exact: true })).toBeVisible();
    await expect(slotRow.getByRole("cell", { name: "1, 3", exact: true })).toBeVisible();
    await expect(slotRow).toContainText("OPEN");

    let updateRequests = 0;

    page.on("request", (request) => {
        if (
            request.url().includes("/api/slots/") &&
            request.method() === "PUT"
        ) {
            updateRequests++;
        }
    });

    // Start editing.
    await slotRow.getByRole("button", { name: "Edit" }).click();

    await expect(page.getByRole("heading", { name: "Edit the slot" })).toBeVisible();

    await page.locator("details.slot-tables-dropdown > summary").click();

    await expect(table1.getByRole("checkbox")).toBeChecked();
    await expect(table3.getByRole("checkbox")).toBeChecked();

    // Change tables and status, but cancel.
    await table1.getByRole("checkbox").uncheck();
    await table5.getByRole("checkbox").check();

    await page.getByLabel("Status").selectOption("CLOSED");

    await page.getByRole("button", { name: "Cancel" }).click();
    
    await expect(page.getByRole("heading", { name: "Add a slot" })).toBeVisible();

    // Original slot must still be unchanged.
    await expect(slotRow.getByRole("cell", { name: "6", exact: true })).toBeVisible();
    await expect(slotRow.getByRole("cell", { name: "1, 3", exact: true })).toBeVisible();
    await expect(slotRow).toContainText("OPEN");

    expect(updateRequests).toBe(0);
});