import { test, expect } from "./fixtures.js";

async function loginAsWarden(page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill("warden.demo@mountainhut.local");
    await page.getByLabel("Password", { exact: true }).fill("DemoWarden123");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("/");
}

test("warden can create, update and delete a table", async ({ page }) => {
    await loginAsWarden(page);
    await page.goto("/staff/slots");

    // CREATE
    await page.getByLabel("Table number").fill("99");
    await page.getByLabel("Seats", { exact: true }).fill("4");
    await page.getByRole("button", { name: "Add table" }).click();

    let tableCard = page.locator(".tables-manager-card").filter({ hasText: "Table 99" });

    await expect(tableCard).toBeVisible();
    await expect(tableCard).toContainText("4 seats available");

    // UPDATE
    await tableCard.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit table" })).toBeVisible();

    await page.getByLabel("Seats", { exact: true }).fill("6");
    await page.getByRole("button", { name: "Save changes" }).click();

    tableCard = page.locator(".tables-manager-card").filter({ hasText: "Table 99" });

    await expect(tableCard).toContainText("6 seats available");

    // DELETE
    await tableCard.getByRole("button", { name: "Delete" }).click();
    await expect(tableCard).toHaveCount(0);
});

test("warden cannot delete a table assigned to a slot", async ({ page }) => {
    await loginAsWarden(page);
    await page.goto("/staff/slots");

    const tableCard = page.locator(".tables-manager-card").filter({has: page.getByText("Table 1", { exact: true })});

    await expect(tableCard).toBeVisible();

    const deleteResponsePromise = page.waitForResponse(
        (response) => response.url().includes("/api/tables/") &&response.request().method() === "DELETE",
    );

    await tableCard.getByRole("button", { name: "Delete" }).click();

    const deleteResponse = await deleteResponsePromise;

    // Backend integrity constraint.
    expect(deleteResponse.status()).toBe(400);

    // The frontend must explain why deletion failed.
    await expect(page.getByRole("alert")).toHaveText(/Cannot delete a table that is assigned to one or more slots/);

    // The table must still exist in the UI.
    await expect(tableCard).toBeVisible();
});