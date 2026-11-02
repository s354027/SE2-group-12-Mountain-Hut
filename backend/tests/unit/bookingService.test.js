import { beforeEach, describe, expect, it, vi } from "vitest";

const { findByPkUser, findByPkSlot, sum, create, bulkCreate } = vi.hoisted(() => ({
  findByPkUser: vi.fn(),
  findByPkSlot: vi.fn(),
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
    Booking: { sum, create },
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

async function expectBookingError(promise, status, message) {
  await expect(promise).rejects.toBeInstanceOf(BookingError);
  await expect(promise).rejects.toMatchObject({ status, message });
}

describe("createBookingForHiker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    findByPkSlot.mockResolvedValue({ status: "OPEN", totalCapacity: 10 });
    sum.mockResolvedValue(8);

    await expectBookingError(
      createBookingForHiker({ ...validInput, numberOfPeople: 4 }),
      409,
      "Insufficient slot capacity",
    );
  });

  it("treats a null booked-seats sum (no existing bookings) as zero", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue({ status: "OPEN", totalCapacity: 4 });
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
    findByPkSlot.mockResolvedValue({ status: "OPEN", totalCapacity: 10 });
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
    findByPkSlot.mockResolvedValue({ status: "OPEN", totalCapacity: 10 });
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
    findByPkSlot.mockResolvedValue({ status: "OPEN", totalCapacity: 10 });
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

  it("rejects when the allocated seats do not add up to the party size", async () => {
    findByPkUser.mockResolvedValue({ role: "HIKER" });
    findByPkSlot.mockResolvedValue({ status: "OPEN", totalCapacity: 10 });
    sum.mockResolvedValue(0);
    const tables = [{ id: 1, tableNumber: 4, seats: 4, allocatedSeats: 3 }];
    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue(tables);

    await expect(createBookingForHiker({ ...validInput, numberOfPeople: 4 })).rejects.toThrow(
      "Invalid table allocation",
    );
    expect(create).not.toHaveBeenCalled();
  });
});
