import { beforeEach, describe, expect, it, vi } from "vitest";
import { allocateTables } from "../../src/services/allocation.js";

const { findAll } = vi.hoisted(() => ({
  findAll: vi.fn(),
}));

const { findFreeTables } = vi.hoisted(() => ({
  findFreeTables: vi.fn(),
}));

const { splitParty } = vi.hoisted(() => ({
  splitParty: vi.fn(),
}));

vi.mock("../../src/db/index.js", () => ({
  models: {
    Slot: { findAll },
  },
}));

vi.mock("../../src/services/tableAvailability.js", () => ({
  findFreeTables,
}));

vi.mock("../../src/services/partySplit.js", () => ({
  splitParty,
}));

describe("allocateTables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unavailable when there are no open slots for the date", async () => {
    findAll.mockResolvedValue([]);

    await expect(
      allocateTables("2026-10-30", "19:00:00", 4),
    ).resolves.toMatchObject({
      available: false,
      reason: "No service available for the selected date",
      partySize: 4,
      tables: [],
      breakdown: null,
    });
  });

  it("returns unavailable when the requested time does not fall within any open slot", async () => {
    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "19:00:00",
        duration: 120,
        meal: "DINNER",
      },
    ]);

    await expect(
      allocateTables("2026-10-30", "12:00:00", 4),
    ).resolves.toMatchObject({
      available: false,
      reason: "The entered time does not fall within any service slot",
      partySize: 4,
      tables: [],
      breakdown: null,
    });
  });

  it("returns unavailable when the slot has no free tables", async () => {
    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "19:00:00",
        duration: 120,
        meal: "DINNER",
      },
    ]);
    findFreeTables.mockResolvedValue([]);

    await expect(
      allocateTables("2026-10-30", "19:00:00", 4),
    ).resolves.toMatchObject({
      available: false,
      reason: "No table available for the slot of the 19:00",
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
    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "19:00:00",
        duration: 120,
        meal: "DINNER",
      },
    ]);
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
      duration: 120,
      meal: "DINNER",
      partySize: 6,
      tables: [
        { id: 1, tableNumber: 4, seats: 4, allocatedSeats: 4 },
        { id: 2, tableNumber: 6, seats: 2, allocatedSeats: 2 },
      ],
      breakdown: "4 + 2 seats",
      summary: "Available seat in the slot of the 19:00 (4 + 2 seats)",
    });
    expect(splitParty).toHaveBeenCalledWith(6, tables);
  });

  it("returns unavailable when the party cannot be allocated", async () => {
    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "19:00:00",
        duration: 120,
        meal: "DINNER",
      },
    ]);
    findFreeTables.mockResolvedValue([{ id: 1, seats: 4 }]);
    splitParty.mockReturnValue(null);

    await expect(
      allocateTables("2026-10-30", "19:00:00", 6),
    ).resolves.toMatchObject({
      available: false,
      reason: "Insufficient places for slot of 19:00",
      slotId: 10,
      partySize: 6,
      tables: [],
      breakdown: null,
    });
  });

  it("returns unavailable when the requested time is less than 20 minutes before the end of the slot", async () => {
    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "19:00:00",
        duration: 60,
        meal: "DINNER",
      },
    ]);
    findFreeTables.mockResolvedValue([{ id: 1, seats: 4 }]);
    splitParty.mockReturnValue([{ id: 1, seats: 4, allocatedSeats: 4 }]);

    await expect(
      allocateTables("2026-10-30", "19:50:00", 4),
    ).resolves.toMatchObject({
      available: false,
      reason:
        "The requested time must be entered at least 20 minutes before the end of the slot",
      slotId: 10,
      partySize: 4,
      tables: [],
      breakdown: null,
    });
  });

  it("treats a missing startTime as midnight instead of throwing", async () => {
    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "19:00:00",
        duration: 120,
        meal: "DINNER",
      },
    ]);

    await expect(
      allocateTables("2026-10-30", "", 4),
    ).resolves.toMatchObject({
      available: false,
      reason: "The entered time does not fall within any service slot",
      partySize: 4,
      tables: [],
      breakdown: null,
    });
  });

  it("returns the full slot duration when the requested time falls inside the slot", async () => {
    const tables = [
      { id: 1, tableNumber: 1, seats: 4 },
    ];

    findAll.mockResolvedValue([
      {
        id: 10,
        date: "2026-10-30",
        startTime: "12:00:00",
        duration: 120,
        meal: "LUNCH",
      },
    ]);

    findFreeTables.mockResolvedValue(tables);

    splitParty.mockReturnValue([
      { ...tables[0], allocatedSeats: 2 },
    ]);

    const result = await allocateTables(
      "2026-10-30",
      "13:30:00",
      2,
    );

    expect(result).toMatchObject({
      available: true,
      slotId: 10,
      startTime: "12:00:00",
      duration: 120,
      meal: "LUNCH",
    });
  });
});
