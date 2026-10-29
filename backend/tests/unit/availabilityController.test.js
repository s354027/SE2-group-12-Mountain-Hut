import { beforeEach, describe, expect, it, vi } from "vitest";

const { allocateTables } = vi.hoisted(() => ({
  allocateTables: vi.fn(),
}));

vi.mock("../../src/services/allocation.js", () => ({
  allocateTables,
}));

import { getAvailability } from "../../src/controllers/availabilityController.js";

function createResponse() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("getAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when date or startTime is missing", async () => {
    const res = createResponse();

    await getAvailability(
      { query: { date: "2026-10-30", partySize: "4" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "date and startTime are required",
    });
    expect(allocateTables).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "1.5", "four", undefined])(
    "returns 400 for invalid partySize %s",
    async (partySize) => {
      const res = createResponse();

      await getAvailability(
        {
          query: {
            date: "2026-10-30",
            startTime: "19:00",
            partySize,
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "partySize must be a positive integer",
      });
      expect(allocateTables).not.toHaveBeenCalled();
    },
  );

  it("normalizes HH:MM and returns the allocation result", async () => {
    const result = {
      available: true,
      partySize: 4,
      tables: [{ id: 1, allocatedSeats: 4 }],
    };
    allocateTables.mockResolvedValue(result);
    const res = createResponse();

    await getAvailability(
      {
        query: {
          date: "2026-10-30",
          startTime: "19:00",
          partySize: "4",
        },
      },
      res,
    );

    expect(allocateTables).toHaveBeenCalledWith(
      "2026-10-30",
      "19:00:00",
      4,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it("preserves an already complete HH:MM:SS time", async () => {
    allocateTables.mockResolvedValue({ available: false });
    const res = createResponse();

    await getAvailability(
      {
        query: {
          date: "2026-10-30",
          startTime: "19:00:00",
          partySize: "4",
        },
      },
      res,
    );

    expect(allocateTables).toHaveBeenCalledWith(
      "2026-10-30",
      "19:00:00",
      4,
    );
  });

  it("returns 500 when availability calculation fails", async () => {
    const error = new Error("database unavailable");
    allocateTables.mockRejectedValue(error);
    const res = createResponse();
    const consoleError = vi
      .spyOn(globalThis.console, "error")
      .mockImplementation(() => {});

    await getAvailability(
      {
        query: {
          date: "2026-10-30",
          startTime: "19:00",
          partySize: "4",
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unexpected error while checking availability",
    });
    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});
