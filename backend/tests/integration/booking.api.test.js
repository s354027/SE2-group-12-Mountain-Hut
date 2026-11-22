import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "mh-booking-api-"));
process.env.DB_PATH = join(tmpDir, "test.sqlite");

const { default: app } = await import("../../src/app.js");
const { sequelize, models } = await import("../../src/db/index.js");
const { hashPassword } = await import("../../src/services/authService.js");

const PASSWORD = "test-password-123";
const HIKER = {
  firstName: "Test",
  lastName: "Hiker",
  email: "booking.integration@test.it",
  role: "HIKER",
};
const EMPLOYEE = {
  firstName: "Test",
  lastName: "Employee",
  email: "booking.employee.integration@test.it",
  role: "EMPLOYEE",
};

let server;
let baseUrl;
let hiker;
let slot;
let table;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  hiker = await models.User.create({
    ...HIKER,
    passwordHash: await hashPassword(PASSWORD),
  });

  await models.User.create({
    ...EMPLOYEE,
    passwordHash: await hashPassword(PASSWORD),
  });

  slot = await models.Slot.create({
    date: "2030-06-15",
    startTime: "19:00",
    duration: 90,
    meal: "DINNER",
    totalCapacity: 4,
    status: "OPEN",
  });

  table = await models.DiningTable.create({
    tableNumber: 1,
    seats: 4,
  });

  await models.SlotTable.create({
    slotId: slot.id,
    tableId: table.id,
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await sequelize.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

// Keep the session cookie between requests, just like a browser.
function createBrowser() {
  let cookie = "";

  return async function request(method, path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookies = response.headers.getSetCookie();
    if (setCookies.length) {
      cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
    }

    const responseText = await response.text();
    let data = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Keep non-JSON responses as null.
    }

    return { status: response.status, data };
  };
}

async function loginAsHiker() {
  const browser = createBrowser();
  const response = await browser("POST", "/api/auth/login", {
    email: HIKER.email,
    password: PASSWORD,
  });

  expect(response.status).toBe(200);
  expect(response.data.role).toBe("HIKER");
  return browser;
}

async function loginAsEmployee() {
  const browser = createBrowser();
  const response = await browser("POST", "/api/auth/login", {
    email: EMPLOYEE.email,
    password: PASSWORD,
  });

  expect(response.status).toBe(200);
  expect(response.data.role).toBe("EMPLOYEE");
  return browser;
}

describe("POST /api/bookings", () => {
  it("requires an authenticated hiker", async () => {
    const response = await createBrowser()("POST", "/api/bookings", {
      slotId: slot.id,
      numberOfPeople: 2,
    });

    expect(response.status).toBe(401);
    expect(await models.Booking.count()).toBe(0);
  });

  it("creates a booking through the API and persists it with its table allocation", async () => {
    const browser = await loginAsHiker();

    const response = await browser("POST", "/api/bookings", {
      slotId: slot.id,
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: "Peanuts",
    });

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      hikerId: hiker.id,
      slotId: slot.id,
      numberOfPeople: 2,
      status: "CONFIRMED",
      tables: [
        {
          id: table.id,
          tableNumber: table.tableNumber,
          allocatedSeats: 2,
        },
      ],
    });
    expect(response.data.id).toEqual(expect.any(Number));

    // Read from the database independently of the HTTP response.
    const savedBooking = await models.Booking.findByPk(response.data.id);
    expect(savedBooking).not.toBeNull();
    expect(savedBooking.toJSON()).toMatchObject({
      id: response.data.id,
      hikerId: hiker.id,
      slotId: slot.id,
      numberOfPeople: 2,
      status: "CONFIRMED",
      allergyFlag: true,
      allergyDescription: "Peanuts",
    });

    const savedAllocation = await models.BookingTable.findOne({
      where: {
        bookingId: savedBooking.id,
        tableId: table.id,
      },
    });
    expect(savedAllocation).not.toBeNull();
    expect(savedAllocation.allocatedSeats).toBe(2);
  });

  it("rejects an invalid party size without writing to the database", async () => {
    const browser = await loginAsHiker();

    const bookingsBefore = await models.Booking.count();
    const allocationsBefore = await models.BookingTable.count();

    const response = await browser("POST", "/api/bookings", {
      slotId: slot.id,
      numberOfPeople: 0,
    });

    expect(response.status).toBe(400);
    expect(response.data).toMatchObject({
      error: "numberOfPeople must be a positive integer",
    });

    // Verify that the invalid request created nothing.
    expect(await models.Booking.count()).toBe(bookingsBefore);
    expect(await models.BookingTable.count()).toBe(allocationsBefore);
  });

  describe("POST /api/bookings/staff", () => {
    beforeEach(async () => {
      await models.BookingTable.destroy({ where: {} });
      await models.Booking.destroy({ where: {} });
    });

    it("requires authentication", async () => {
      const response = await createBrowser()("POST", "/api/bookings/staff", {
        hiker: { mode: "EXISTING", id: hiker.id },
        slotId: slot.id,
        numberOfPeople: 2,
      });

      expect(response.status).toBe(401);
      expect(await models.Booking.count()).toBe(0);
    });

    it("is reserved to employees", async () => {
      const browser = await loginAsHiker();
      const response = await browser("POST", "/api/bookings/staff", {
        hiker: { mode: "EXISTING", id: hiker.id },
        slotId: slot.id,
        numberOfPeople: 2,
      });

      expect(response.status).toBe(403);
      expect(await models.Booking.count()).toBe(0);
    });

    it("creates a booking for an existing hiker", async () => {
      const browser = await loginAsEmployee();
      const response = await browser("POST", "/api/bookings/staff", {
        hiker: { mode: "EXISTING", id: hiker.id },
        slotId: slot.id,
        numberOfPeople: 2,
        allergyFlag: true,
        allergyDescription: "Peanuts",
        dietaryRequirements: [
          { allergies: true, description: "Peanut allergy" },
        ],
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        hikerId: hiker.id,
        slotId: slot.id,
        numberOfPeople: 2,
        status: "CONFIRMED",
        hiker: {
          id: hiker.id,
          firstName: "Test",
          lastName: "Hiker",
          isTemporary: false,
        },
      });
      expect(response.data.generatedPassword).toBeUndefined();

      const savedBooking = await models.Booking.findByPk(response.data.id);
      expect(savedBooking).not.toBeNull();
      expect(savedBooking.toJSON()).toMatchObject({
        hikerId: hiker.id,
        slotId: slot.id,
        numberOfPeople: 2,
        status: "CONFIRMED",
        allergyFlag: true,
        allergyDescription: "Peanuts",
      });

      const allocation = await models.BookingTable.findOne({
        where: { bookingId: savedBooking.id, tableId: table.id },
      });
      expect(allocation).not.toBeNull();
      expect(allocation.allocatedSeats).toBe(2);
    });

    it("creates a full hiker account and returns the generated password", async () => {
      const browser = await loginAsEmployee();
      const email = "staff.full.integration@test.it";
      const response = await browser("POST", "/api/bookings/staff", {
        hiker: {
          mode: "FULL",
          firstName: "Full",
          lastName: "Hiker",
          email,
          phone: "3401234567",
          notes: "Staff-created account",
          emergencyContact: "3487654321",
        },
        slotId: slot.id,
        numberOfPeople: 1,
      });

      expect(response.status).toBe(201);
      expect(response.data.generatedPassword).toEqual(expect.any(String));
      expect(response.data.generatedPassword.length).toBeGreaterThan(0);
      expect(response.data.hiker).toMatchObject({
        firstName: "Full",
        lastName: "Hiker",
        email,
        phone: "3401234567",
        isTemporary: false,
      });

      const savedHiker = await models.User.findOne({ where: { email } });
      expect(savedHiker).not.toBeNull();
      expect(savedHiker.role).toBe("HIKER");
      expect(savedHiker.mustChangePassword).toBe(true);
      expect(savedHiker.notes).toBe("Staff-created account");
      expect(savedHiker.emergencyContact).toBe("3487654321");

      const savedBooking = await models.Booking.findByPk(response.data.id);
      expect(savedBooking.hikerId).toBe(savedHiker.id);
    });

    it("creates a temporary hiker for quick mode", async () => {
      const browser = await loginAsEmployee();
      const response = await browser("POST", "/api/bookings/staff", {
        hiker: {
          mode: "QUICK",
          firstName: "Quick",
          lastName: "Visitor",
          phone: "3331112222",
        },
        slotId: slot.id,
        numberOfPeople: 3,
      });

      expect(response.status).toBe(201);
      expect(response.data.generatedPassword).toBeUndefined();
      expect(response.data.hiker).toMatchObject({
        firstName: "Quick",
        lastName: "Visitor",
        email: null,
        phone: "3331112222",
        isTemporary: true,
      });

      const savedHiker = await models.User.findByPk(response.data.hiker.id);
      expect(savedHiker).not.toBeNull();
      expect(savedHiker.isTemporary).toBe(true);
      expect(savedHiker.mustChangePassword).toBe(false);
      expect(savedHiker.email).toBeNull();

      const savedBooking = await models.Booking.findByPk(response.data.id);
      expect(savedBooking.hikerId).toBe(savedHiker.id);
      expect(savedBooking.numberOfPeople).toBe(3);
    });

    it("rejects invalid input without creating records", async () => {
      const browser = await loginAsEmployee();
      const usersBefore = await models.User.count();
      const bookingsBefore = await models.Booking.count();

      const response = await browser("POST", "/api/bookings/staff", {
        hiker: { mode: "QUICK", firstName: "Invalid", phone: "3331112222" },
        slotId: slot.id,
        numberOfPeople: 0,
      });

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        error: "numberOfPeople must be a positive integer",
      });
      expect(await models.User.count()).toBe(usersBefore);
      expect(await models.Booking.count()).toBe(bookingsBefore);
    });
  });

  it("rejects non boolean allergy flag", async () => {
    const browser = await loginAsEmployee();
    const usersBefore = await models.User.count();
    const bookingsBefore = await models.Booking.count();

    const response = await browser("POST", "/api/bookings/staff", {
      hiker: { mode: "QUICK", firstName: "John" },
      slotId: slot.id,
      numberOfPeople: 2,
      allergyFlag: "invalid",
    });

    expect(response.status).toBe(400);
    expect(response.data).toMatchObject({
      error: "allergyFlag must be a boolean",
    });
    expect(await models.User.count()).toBe(usersBefore);
    expect(await models.Booking.count()).toBe(bookingsBefore);
  });

  it("rejects invalid allergy description", async () => {
    const browser = await loginAsEmployee();
    const usersBefore = await models.User.count();
    const bookingsBefore = await models.Booking.count();

    const response = await browser("POST", "/api/bookings/staff", {
      hiker: { mode: "QUICK", firstName: "John" },
      slotId: slot.id,
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: false,
    });

    expect(response.status).toBe(400);
    expect(response.data).toMatchObject({
      error: "Invalid allergyDescription",
    });
    expect(await models.User.count()).toBe(usersBefore);
    expect(await models.Booking.count()).toBe(bookingsBefore);
  });
});
