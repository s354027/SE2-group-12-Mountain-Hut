import { beforeEach, describe, expect, it, vi } from "vitest";

const { findByPk, findAll } = vi.hoisted(() => ({
  findByPk: vi.fn(),
  findAll: vi.fn(),
}));

vi.mock("../../src/db/index.js", () => ({
  models: {
    DiningTable: {},
    Slot: { findByPk },
    Booking: { findAll },
  },
}));

import { findFreeTables } from "../../src/services/tableAvailability.js";

function table(data) {
  return {
    get: vi.fn(() => data),
  };
}

describe("findFreeTables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list when the slot does not exist", async () => {
    findByPk.mockResolvedValue(null);

    await expect(findFreeTables(1)).resolves.toEqual([]);
    expect(findAll).not.toHaveBeenCalled();
  });

  it("returns an empty list when the slot has no tables", async () => {
    findByPk.mockResolvedValue({
      tables: [],
    });

    await expect(findFreeTables(1)).resolves.toEqual([]);
    expect(findAll).not.toHaveBeenCalled();
  });

  it("returns full capacity when the slot has no active bookings", async () => {
    findByPk.mockResolvedValue({
      tables: [
        table({ id: 1, tableNumber: 4, seats: 4 }),
        table({ id: 2, tableNumber: 6, seats: 6 }),
      ],
    });
    findAll.mockResolvedValue([]);

    await expect(findFreeTables(1)).resolves.toEqual([
      {
        id: 1,
        tableNumber: 4,
        totalSeats: 4,
        occupiedSeats: 0,
        seats: 4,
        availableSeats: 4,
      },
      {
        id: 2,
        tableNumber: 6,
        totalSeats: 6,
        occupiedSeats: 0,
        seats: 6,
        availableSeats: 6,
      },
    ]);
  });

  it("subtracts active booking seats and excludes full tables", async () => {
    findByPk.mockResolvedValue({
      tables: [
        table({ id: 1, tableNumber: 4, seats: 4 }),
        table({ id: 2, tableNumber: 6, seats: 6 }),
      ],
    });
    findAll.mockResolvedValue([
      {
        numberOfPeople: 4,
        tables: [{ id: 1, seats: 4 }],
      },
      {
        numberOfPeople: 3,
        tables: [{ id: 2, seats: 6 }],
      },
    ]);

    await expect(findFreeTables(1)).resolves.toEqual([
      {
        id: 2,
        tableNumber: 6,
        totalSeats: 6,
        occupiedSeats: 3,
        seats: 3,
        availableSeats: 3,
      },
    ]);
  });

  it("distributes a booking across assigned tables", async () => {
    findByPk.mockResolvedValue({
      tables: [
        table({ id: 1, tableNumber: 4, seats: 4 }),
        table({ id: 2, tableNumber: 6, seats: 6 }),
      ],
    });
    findAll.mockResolvedValue([
      {
        numberOfPeople: 7,
        tables: [
          { id: 1, seats: 4 },
          { id: 2, seats: 6 },
        ],
      },
    ]);

    await expect(findFreeTables(1)).resolves.toEqual([
      {
        id: 2,
        tableNumber: 6,
        totalSeats: 6,
        occupiedSeats: 3,
        seats: 3,
        availableSeats: 3,
      },
    ]);
  });

  it("skips bookings with no tables", async () => {
    findByPk.mockResolvedValue({
      tables: [
        table({ id: 1, tableNumber: 4, seats: 4 }),
        table({ id: 2, tableNumber: 6, seats: 6 }),
      ],
    });

    findAll.mockResolvedValue([
      {
        numberOfPeople: 4,
        tables: [],
      },
    ]);

    await expect(findFreeTables(1)).resolves.toEqual([
      {
        id: 1,
        tableNumber: 4,
        totalSeats: 4,
        occupiedSeats: 0,
        seats: 4,
        availableSeats: 4,
      },
      {
        id: 2,
        tableNumber: 6,
        totalSeats: 6,
        occupiedSeats: 0,
        seats: 6,
        availableSeats: 6,
      },
    ]);
  });

  it("returns an empty list when no tables are available after accounting for bookings", async () => {
    findByPk.mockResolvedValue({
      tables: [
        table({ id: 1, tableNumber: 4, seats: 4 }),
        table({ id: 2, tableNumber: 6, seats: 6 }),
      ],
    });
    findAll.mockResolvedValue([
      {
        numberOfPeople: 4,
        tables: [{ id: 1, seats: 4 }],
      },
      {
        numberOfPeople: 6,
        tables: [{ id: 2, seats: 6 }],
      },
    ]);

    await expect(findFreeTables(1)).resolves.toEqual([]);
    expect(findAll).toHaveBeenCalled();
  });
});
