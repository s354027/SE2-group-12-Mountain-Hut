import { test as base, expect } from "@playwright/test";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const test = base.extend({
  resetBookings: [
    async ({}, use) => {
      await execAsync("npm --prefix backend run e2e:reset-bookings");

      await use();
    },
    { auto: true },
  ],
});

export { expect };