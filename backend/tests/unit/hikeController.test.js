import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createHikeController } from "../../src/controllers/hikeController.js";

const { findAll } = vi.hoisted(() => ({
  findAll: vi.fn(),
}));

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = () => ({});

const { getActiveHikes } = createHikeController({
  Hike: { findAll },
  User: {},
});

describe("Hike Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getActiveHikes", () => {
    it("returns only ongoing hikes sorted by expected return time", async () => {
      const hikes = [
        { id: 1, destination: "Rifugio Gastaldi", status: "ONGOING" },
        { id: 2, destination: "Rifugio Vittorio Sella", status: "ONGOING" },
      ];
      findAll.mockResolvedValue(hikes);
      const req = mockReq();
      const res = mockRes();

      await getActiveHikes(req, res);

      expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ONGOING" },
          order: [["expectedReturnTime", "ASC"]],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(hikes);
    });

    it("includes the hiker's identity and contacts in the query", async () => {
      findAll.mockResolvedValue([]);
      const req = mockReq();
      const res = mockRes();

      await getActiveHikes(req, res);

      const call = findAll.mock.calls[0][0];
      expect(call.include).toEqual([
        expect.objectContaining({
          as: "hiker",
          attributes: ["id", "firstName", "lastName", "phone", "email", "emergencyContact"],
        }),
      ]);
    });

    it("returns 500 when the query fails", async () => {
      findAll.mockRejectedValue(new Error("db down"));
      const req = mockReq();
      const res = mockRes();

      await getActiveHikes(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to retrieve active hikes" });
    });
  });
});
