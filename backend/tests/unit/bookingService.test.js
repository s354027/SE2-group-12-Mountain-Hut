import { beforeEach, describe, expect, it, vi } from "vitest";

const { findByPkUser, findByPkSlot, findOne, sum, create, bulkCreate } = vi.hoisted(() => ({
  findByPkUser: vi.fn(),
  findByPkSlot: vi.fn(),
  findOne: vi.fn(),
  sum: vi.fn(),
  create: vi.fn(),
  bulkCreate: vi.fn(),
}));

const { transaction } = vi.hoisted(() => ({
  transaction: vi.fn((_options, callback) => callback({})),
}));

const { findFreeTables } = vi.hoisted(() => ({
  findFreeTables: vi.fn(),
}));

const { splitParty } = vi.hoisted(() => ({
  splitParty: vi.fn(),
}));

vi.mock("../../src/db/index.js", () => ({
  sequelize: { transaction },
  models: {
    User: { findByPk: findByPkUser },
    Slot: { findByPk: findByPkSlot },
    Booking: { findOne, sum, create },
    BookingTable: { bulkCreate },
  },
}));

vi.mock("../../src/services/tableAvailability.js", () => ({
  findFreeTables,
}));

vi.mock("../../src/services/partySplit.js", () => ({
  splitParty,
}));

import { createBookingForHiker, BookingError } from "../../src/services/bookingService.js";

const validInput = {
  hikerId: 1,
  slotId: 10,
  numberOfPeople: 4,
};

const futureSlot = {
  date: "2099-01-01",
  startTime: "20:00:00",
  status: "OPEN",
  totalCapacity: 10
};

async function expectBookingError(promise, status, message) {
  await expect(promise).rejects.toBeInstanceOf(BookingError);
  await expect(promise).rejects.toMatchObject({ status, message });
}

beforeEach(() => {
  vi.clearAllMocks();

  transaction.mockReset();
  transaction.mockImplementation(
    (_options, callback) => callback({})
  );

  findOne.mockResolvedValue(null); //by default: the hiker doesn't have a reservation
});

describe("createBookingForHiker", () => {

  it("rejects an invalid party size", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, numberOfPeople: 0 }),
      400,
      "Invalid party size",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-integer party size", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, numberOfPeople: 2.5 }),
      400,
      "Invalid party size",
    );
  });

  it("rejects an invalid slot id", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, slotId: 0 }),
      400,
      "Invalid slot ID",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean allergy flag", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, allergyFlag: "yes" }),
      400,
      "Invalid allergy flag",
    );
  });

  it("rejects a missing allergy description when allergyFlag is true", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, allergyFlag: true, allergyDescription: "   " }),
      400,
      "Allergy description is required",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects when the hiker does not exist or is not a HIKER", async () => {
    findByPkUser.mockResolvedValue(null);

    await expectBookingError(createBookingForHiker(validInput), 403, "Invalid hiker");

    findByPkUser.mockResolvedValue({ role: "WARDEN" });
    await expectBookingError(createBookingForHiker(validInput), 403, "Invalid hiker");
  });

  it("rejects when the slot does not exist", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(null);

    await expectBookingError(createBookingForHiker(validInput), 404, "Slot not found");
  });

  it("rejects when the slot is not OPEN", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue({ status: "CLOSED", totalCapacity: 20 });

    await expectBookingError(createBookingForHiker(validInput), 409, "Slot is not available");
  });

  it("rejects when the party exceeds the remaining slot capacity", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(futureSlot);
    sum.mockResolvedValue(8);

    await expectBookingError(
      createBookingForHiker({ ...validInput, numberOfPeople: 4 }),
      409,
      "Insufficient slot capacity",
    );
  });

  it("treats a null booked-seats sum (no existing bookings) as zero", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue({ ...futureSlot, totalCapacity: 4 });
    sum.mockResolvedValue(null);
    findFreeTables.mockResolvedValue([{ id: 1, tableNumber: 1, seats: 4 }]);
    splitParty.mockReturnValue([{ id: 1, tableNumber: 1, seats: 4, allocatedSeats: 4 }]);
    create.mockResolvedValue({ id: 99, hikerId: 1, slotId: 10, numberOfPeople: 4, status: "CONFIRMED" });
    bulkCreate.mockResolvedValue([]);

    await expect(createBookingForHiker({ ...validInput, numberOfPeople: 4 })).resolves.toMatchObject({
      id: 99,
    });
  });

  it("rejects when no table combination can seat the party", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(futureSlot);
    sum.mockResolvedValue(0);
    findFreeTables.mockResolvedValue([]);
    splitParty.mockReturnValue(null);

    await expectBookingError(
      createBookingForHiker(validInput),
      409,
      "Not enough available table seats",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the booking and persists the allocated tables", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(futureSlot);
    sum.mockResolvedValue(0);
    const tables = [
      { id: 1, tableNumber: 4, seats: 4, allocatedSeats: 4 },
      { id: 2, tableNumber: 6, seats: 2, allocatedSeats: 2 },
    ];
    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);
    create.mockResolvedValue({
      id: 99,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 6,
      status: "CONFIRMED",
    });
    bulkCreate.mockResolvedValue([]);

    const result = await createBookingForHiker({ ...validInput, numberOfPeople: 6 });

    expect(result).toEqual({
      id: 99,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 6,
      status: "CONFIRMED",
      tables: [
        { id: 1, tableNumber: 4, allocatedSeats: 4 },
        { id: 2, tableNumber: 6, allocatedSeats: 2 },
      ],
    });

    expect(bulkCreate).toHaveBeenCalledWith(
      [
        { bookingId: 99, tableId: 1, allocatedSeats: 4 },
        { bookingId: 99, tableId: 2, allocatedSeats: 2 },
      ],
      expect.objectContaining({ validate: true }),
    );
  });

  it("stores a trimmed allergy description when allergyFlag is true", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(futureSlot);
    sum.mockResolvedValue(0);
    const tables = [{ id: 1, tableNumber: 4, seats: 4, allocatedSeats: 4 }];
    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);
    create.mockResolvedValue({
      id: 100,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 4,
      status: "CONFIRMED",
    });
    bulkCreate.mockResolvedValue([]);

    await createBookingForHiker({
      ...validInput,
      numberOfPeople: 4,
      allergyFlag: true,
      allergyDescription: "  nuts  ",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ allergyFlag: true, allergyDescription: "nuts" }),
      expect.anything(),
    );
  });

  it("rejects a non-array dietaryRequirements", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, dietaryRequirements: "vegetarian" }),
      400,
      "dietaryRequirements must be an array",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry that is not an object", async () => {
    await expectBookingError(
      createBookingForHiker({ ...validInput, dietaryRequirements: ["vegetarian"] }),
      400,
      "Each dietary requirement must be an object",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry with a non-boolean allergies flag", async () => {
    await expectBookingError(
      createBookingForHiker({
        ...validInput,
        dietaryRequirements: [{ allergies: "yes", description: "vegetarian" }],
      }),
      400,
      "Each dietary requirement must have an allergies boolean",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry with a blank description", async () => {
    await expectBookingError(
      createBookingForHiker({
        ...validInput,
        dietaryRequirements: [{ allergies: false, description: "   " }],
      }),
      400,
      "Each dietary requirement must have a non-empty description",
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it("trims and persists the dietary requirements list", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(futureSlot);
    sum.mockResolvedValue(0);
    const tables = [{ id: 1, tableNumber: 4, seats: 4, allocatedSeats: 4 }];
    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);
    create.mockResolvedValue({
      id: 101,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 4,
      status: "CONFIRMED",
    });
    bulkCreate.mockResolvedValue([]);

    await createBookingForHiker({
      ...validInput,
      numberOfPeople: 4,
      dietaryRequirements: [
        { allergies: true, description: "  1 vegan, peanut allergy  " },
        { allergies: false, description: "2 vegetarians" },
      ],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryRequirements: [
          { allergies: true, description: "1 vegan, peanut allergy" },
          { allergies: false, description: "2 vegetarians" },
        ],
      }),
      expect.anything(),
    );
  });

  it("rejects when the allocated seats do not add up to the party size", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue(futureSlot);
    sum.mockResolvedValue(0);
    const tables = [{ id: 1, tableNumber: 4, seats: 4, allocatedSeats: 3 }];
    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);

    await expect(createBookingForHiker({ ...validInput, numberOfPeople: 4 })).rejects.toThrow(
      "Invalid table allocation",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a booking made less than 2 hours before the slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-10T18:30:00"));

    findByPkUser.mockResolvedValue({ role: "HIKER" });

    findByPkSlot.mockResolvedValue({
      date: "2030-06-10",
      startTime: "20:00:00",
      status: "OPEN",
      totalCapacity: 10
    });

    await expectBookingError(
      createBookingForHiker(validInput),
      409,
      "Booking deadline has passed"
    );

    expect(create).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("allows a booking exactly 2 hours before the slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-10T18:00:00"));

    findByPkUser.mockResolvedValue({ role: "HIKER" });

    findByPkSlot.mockResolvedValue({
      date: "2030-06-10",
      startTime: "20:00:00",
      status: "OPEN",
      totalCapacity: 10
    });

    findOne.mockResolvedValue(null);
    sum.mockResolvedValue(0);

    const tables = [
      {
        id: 1,
        tableNumber: 1,
        seats: 4,
        allocatedSeats: 4
      }
    ];

    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);

    create.mockResolvedValue({
      id: 99,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 4,
      status: "CONFIRMED"
    });

    bulkCreate.mockResolvedValue([]);

    await expect(
      createBookingForHiker(validInput)
    ).resolves.toMatchObject({
      id: 99
    });

    vi.useRealTimers();
  });

  it("rejects when the hiker already has an active booking for the slot", async () => {
    findByPkUser.mockResolvedValue({
      role: "HIKER"
    });

    findByPkSlot.mockResolvedValue(futureSlot);

    findOne.mockResolvedValue({
      id: 50,
      hikerId: 1,
      slotId: 10,
      status: "CONFIRMED"
    });

    await expectBookingError(
      createBookingForHiker(validInput),
      409,
      "Hiker already has a booking for this slot"
    );

    expect(sum).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

// TESTS MH-29: Concurren bookings
describe("MH-29 concurrent booking transaction handling", () => {
  //checks if SQLITE_BUSY starts a retry, as intended
  it("retries the booking transaction when SQLite is busy", async () => {
    const busyError = new Error("database is locked");
    busyError.original = {
      code: "SQLITE_BUSY"
    };

    transaction
      .mockRejectedValueOnce(busyError)
      .mockImplementationOnce(
        (_options, callback) => callback({})
      );

    findByPkUser.mockResolvedValue({role: "HIKER"});

    findByPkSlot.mockResolvedValue(futureSlot);

    sum.mockResolvedValue(0);

    const tables = [
      {
        id: 1,
        tableNumber: 1,
        seats: 4,
        allocatedSeats: 4
      }
    ];

    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);

    create.mockResolvedValue({
      id: 99,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 4,
      status: "CONFIRMED"
    });

    bulkCreate.mockResolvedValue([]);

    const result = await createBookingForHiker(validInput);

    expect(result.id).toBe(99);

    expect(transaction).toHaveBeenCalledTimes(2);
  });

  //checks that a generic error (not SQLITE-BUSY) doesn't trigger a retry
  it("does not retry non-SQLite-busy errors", async () => {
    const error = new Error("Unexpected database error");

    transaction.mockRejectedValueOnce(error);

    await expect(
      createBookingForHiker(validInput)
    ).rejects.toBe(error);

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  //checks that, after re-trying for "MAX_BUSY_RETRIES", an error is trown
  it("returns 503 when SQLite remains busy after all retries", async () => {
    const busyError = new Error("database is locked");
    busyError.original = {
      code: "SQLITE_BUSY"
    };

    transaction.mockRejectedValue(busyError);

    await expect(
      createBookingForHiker(validInput)
    ).rejects.toMatchObject({
      status: 503,
      message: "Booking service temporarily busy"
    });

    expect(transaction).toHaveBeenCalledTimes(5); //5 because by default MAX_BUSY_RETRIES = 4
  });
  

});