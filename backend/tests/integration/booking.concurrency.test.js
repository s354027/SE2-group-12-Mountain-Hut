import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import {
  mkdtempSync,
  rmSync
} from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(
  join(tmpdir(), "mh-booking-concurrency-")
);

process.env.DB_PATH = join(
  tmpDir,
  "test.sqlite"
);

const { sequelize, models } =
  await import("../../src/db/index.js");

const {
  createBookingForHiker,
  BookingError
} = await import(
  "../../src/services/bookingService.js"
);

beforeEach(async () => {
  await sequelize.sync({
    force: true
  });
});

afterAll(async () => {
  await sequelize.close();

  rmSync(tmpDir, {
    recursive: true,
    force: true
  });
});

//setup:
async function createScenario({
  slotCapacity,
  tableSeats
}) {
  const hiker1 = await models.User.create({
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario@test.it",
    passwordHash: "test",
    role: "HIKER"
  });

  const hiker2 = await models.User.create({
    firstName: "Luigi",
    lastName: "Bianchi",
    email: "luigi@test.it",
    passwordHash: "test",
    role: "HIKER"
  });

  const slot = await models.Slot.create({
    date: "2030-01-01",
    startTime: "19:00",
    duration: 90,
    meal: "DINNER",
    totalCapacity: slotCapacity,
    status: "OPEN"
  });

  const table = await models.DiningTable.create({
    tableNumber: 1,
    seats: tableSeats
  });

  await models.SlotTable.create({
    slotId: slot.id,
    tableId: table.id
  });

  return {
    hiker1,
    hiker2,
    slot
  };
}

//tests:
describe("concurrent bookings", () => {
    it("prevents overbooking when two requests compete for the same slot", async () => {
        const {
        hiker1,
        hiker2,
        slot
        } = await createScenario({
            slotCapacity: 4,
            tableSeats: 4
        });

        const results = await Promise.allSettled([
            createBookingForHiker({
                hikerId: hiker1.id,
                slotId: slot.id,
                numberOfPeople: 3
        }),

        createBookingForHiker({
            hikerId: hiker2.id,
            slotId: slot.id,
            numberOfPeople: 3
        })
        ]);

        const successful = results.filter(
            result => result.status === "fulfilled"
        );

        const failed = results.filter(
            result => result.status === "rejected"
        );

        expect(successful).toHaveLength(1);
        expect(failed).toHaveLength(1);

        expect(failed[0].reason).toBeInstanceOf(BookingError);

        expect(failed[0].reason.status).toBe(409);

        const bookedSeats = await models.Booking.sum(
            "numberOfPeople",
            {
                where: {
                    slotId: slot.id,
                    status: "CONFIRMED"
                }
            }
        );

        expect(bookedSeats).toBe(3);
        expect(bookedSeats).toBeLessThanOrEqual(slot.totalCapacity);
    });

    it("allows both concurrent bookings when enough capacity exists", async () => {
        const {
            hiker1,
            hiker2,
            slot
        } = await createScenario({
            slotCapacity: 6,
            tableSeats: 6
        });

        const results = await Promise.allSettled([
            createBookingForHiker({
            hikerId: hiker1.id,
            slotId: slot.id,
            numberOfPeople: 3
            }),

            createBookingForHiker({
            hikerId: hiker2.id,
            slotId: slot.id,
            numberOfPeople: 3
            })
        ]);

        const successful = results.filter(
            result => result.status === "fulfilled"
        );

        expect(successful).toHaveLength(2);

        const bookedSeats =
            await models.Booking.sum(
            "numberOfPeople",
            {
                where: {
                slotId: slot.id,
                status: "CONFIRMED"
                }
            }
            );

        expect(bookedSeats).toBe(6);
    });

    it("prevents overbooking when slot capacity is sufficient but table seats are not", async () => {
        const {
            hiker1,
            hiker2,
            slot
        } = await createScenario({
            slotCapacity: 10,
            tableSeats: 4
        });

        const results = await Promise.allSettled([
            createBookingForHiker({
            hikerId: hiker1.id,
            slotId: slot.id,
            numberOfPeople: 3
            }),

            createBookingForHiker({
            hikerId: hiker2.id,
            slotId: slot.id,
            numberOfPeople: 3
            })
        ]);

        const successful = results.filter(
            result => result.status === "fulfilled"
        );

        const failed = results.filter(
            result => result.status === "rejected"
        );

        // Only one booking can physically fit at the table
        expect(successful).toHaveLength(1);
        expect(failed).toHaveLength(1);

        expect(failed[0].reason)
            .toBeInstanceOf(BookingError);

        expect(failed[0].reason.status)
            .toBe(409);

        expect(failed[0].reason.message)
            .toBe("Not enough available table seats");

        // Verify the persisted state
        const bookings = await models.Booking.findAll({
            where: {
            slotId: slot.id,
            status: "CONFIRMED"
            }
        });

        expect(bookings).toHaveLength(1);
        expect(bookings[0].numberOfPeople).toBe(3);

        const allocatedSeats = await models.BookingTable.sum(
            "allocatedSeats"
        );

        expect(allocatedSeats).toBe(3);
        expect(allocatedSeats).toBeLessThanOrEqual(4);
    });
});



