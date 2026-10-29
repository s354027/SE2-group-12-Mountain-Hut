import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOne } = vi.hoisted(() => ({
  findOne: vi.fn(),
}));

const { findFreeTables } = vi.hoisted(() => ({
  findFreeTables: vi.fn(),
}));

const { splitParty } = vi.hoisted(() => ({
  splitParty: vi.fn(),
}));

vi.mock("../../src/db/index.js", () => ({
  models: {
    Slot: { findOne },
  },
}));

vi.mock("../../src/services/tableAvailability.js", () => ({
  findFreeTables,
}));

vi.mock("../../src/services/partySplit.js", () => ({
  splitParty,
}));

import { allocateTables } from "../../src/services/allocation.js";

describe("allocateTables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unavailable when no slot matches the requested date and time", async () => {
    findOne.mockResolvedValue(null);

    await expect(allocateTables("2026-10-30", "19:00:00", 4)).resolves.toMatchObject({
      available: false,
      reason: "No slot found for given date and time",
      partySize: 4,
      tables: [],
      breakdown: null,
    });
  });

  it("returns unavailable when the slot has no free tables", async () => {
    findOne.mockResolvedValue({
      id: 10,
      date: "2026-10-30",
      startTime: "19:00:00",
    });
    findFreeTables.mockResolvedValue([]);

    await expect(allocateTables("2026-10-30", "19:00:00", 4)).resolves.toMatchObject({
      available: false,
      reason: "No available tables in this time slot",
      slotId: 10,
      partySize: 4,
      tables: [],
      breakdown: null,
    });
    expect(splitParty).not.toHaveBeenCalled();
  });

  it("returns the selected tables and allocation breakdown", async () => {
    const tables = [
      { id: 1, tableNumber: 4, seats: 4 },
      { id: 2, tableNumber: 6, seats: 2 },
    ];
    findOne.mockResolvedValue({
      id: 10,
      date: "2026-10-30",
      startTime: "19:00:00",
    });
    findFreeTables.mockResolvedValue(tables);
    splitParty.mockReturnValue([
      { ...tables[0], allocatedSeats: 4 },
      { ...tables[1], allocatedSeats: 2 },
    ]);

    await expect(allocateTables("2026-10-30", "19:00:00", 6)).resolves.toEqual({
      available: true,
      slotId: 10,
      date: "2026-10-30",
      startTime: "19:00:00",
      partySize: 6,
      tables: [
        { id: 1, tableNumber: 4, seats: 4, allocatedSeats: 4 },
        { id: 2, tableNumber: 6, seats: 2, allocatedSeats: 2 },
      ],
      breakdown: "4 + 2 seats",
      summary: "Party of 6 available (4 + 2 seats)",
    });
    expect(splitParty).toHaveBeenCalledWith(6, tables);
  });

  it("returns unavailable when the party cannot be allocated", async () => {
    findOne.mockResolvedValue({
      id: 10,
      date: "2026-10-30",
      startTime: "19:00:00",
    });
    findFreeTables.mockResolvedValue([{ id: 1, seats: 4 }]);
    splitParty.mockReturnValue(null);

    await expect(allocateTables("2026-10-30", "19:00:00", 6)).resolves.toMatchObject({
      available: false,
      reason: "Insufficient seats or valid table arrangement not possible",
      slotId: 10,
      partySize: 6,
      tables: [],
      breakdown: null,
    });
  });
});
