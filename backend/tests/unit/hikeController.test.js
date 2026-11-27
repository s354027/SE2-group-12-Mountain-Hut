import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createHikeController } from "../../src/controllers/hikeController.js";

const { findAll, create, findByPk, update } = vi.hoisted(() => ({
  findAll: vi.fn(),
  create: vi.fn(),
  findByPk: vi.fn(),
  update: vi.fn(),
}));

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = ({ body = undefined, params = {}, sessionUserId = 1 } = {}) => ({
  body,
  params,
  session: { user: { id: sessionUserId } },
});

const { getActiveHikes, createHike, getMyHikes, closeHike } = createHikeController({
  Hike: { findAll, create, findByPk, update },
  User: {},
});

function futureDate(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

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

  describe("createHike", () => {
    it("rejects a non-object body", async () => {
      const req = mockReq({ body: "not an object" });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid request body" });
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a non-string route", async () => {
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          route: 123,
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid route" });
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects waypoints that aren't an array of non-empty strings", async () => {
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          waypoints: ["  "],
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "waypoints must be an array of non-empty strings" });
      expect(create).not.toHaveBeenCalled();
    });

    it("treats a null route and null waypoints the same as omitting them", async () => {
      create.mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          route: null,
          waypoints: null,
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ route: null, waypoints: [] }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("normalizes a whitespace-only route to null", async () => {
      create.mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          route: "   ",
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ route: null }));
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("trims route and each waypoint before persisting them", async () => {
      create.mockResolvedValue({ id: 1 });
      const req = mockReq({
        body: {
          destination: "  Rifugio Gastaldi  ",
          route: "  Via normale  ",
          waypoints: [" Lago delle Rocce "],
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: "Rifugio Gastaldi",
          route: "Via normale",
          waypoints: ["Lago delle Rocce"],
        }),
      );
    });

    it("rejects a departureTime that is not in the future", async () => {
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          departureTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          expectedReturnTime: futureDate(3),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "departureTime must be in the future" });
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects an expectedReturnTime before departureTime", async () => {
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          departureTime: futureDate(5),
          expectedReturnTime: futureDate(2),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "expectedReturnTime must be after departureTime" });
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a missing destination", async () => {
      const req = mockReq({
        body: { departureTime: futureDate(2), expectedReturnTime: futureDate(5) },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "destination is required" });
      expect(create).not.toHaveBeenCalled();
    });

    it("creates the hike for the authenticated hiker on valid input", async () => {
      const departureTime = futureDate(2);
      const expectedReturnTime = futureDate(6);
      const created = { id: 1 };
      create.mockResolvedValue(created);

      const req = mockReq({
        sessionUserId: 42,
        body: {
          destination: "Rifugio Gastaldi",
          route: "Pian della Mussa - Rifugio Gastaldi",
          waypoints: ["Lago delle Rocce"],
          departureTime,
          expectedReturnTime,
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          hikerId: 42,
          destination: "Rifugio Gastaldi",
          route: "Pian della Mussa - Rifugio Gastaldi",
          waypoints: ["Lago delle Rocce"],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("returns 500 when creation fails", async () => {
      create.mockRejectedValue(new Error("db down"));
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to register hike" });
    });

    it("returns 400 when the model rejects the data with a validation error", async () => {
      const validationError = new Error("validation failed");
      validationError.name = "SequelizeValidationError";
      create.mockRejectedValue(validationError);
      const req = mockReq({
        body: {
          destination: "Rifugio Gastaldi",
          departureTime: futureDate(2),
          expectedReturnTime: futureDate(5),
        },
      });
      const res = mockRes();

      await createHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid hike data" });
    });
  });

  describe("getMyHikes", () => {
    it("returns only the authenticated hiker's hikes, newest departure first", async () => {
      const hikes = [{ id: 1, hikerId: 7 }];
      findAll.mockResolvedValue(hikes);
      const req = mockReq({ sessionUserId: 7 });
      const res = mockRes();

      await getMyHikes(req, res);

      expect(findAll).toHaveBeenCalledWith({
        where: { hikerId: 7 },
        order: [["departureTime", "DESC"]],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(hikes);
    });

    it("returns 500 when the query fails", async () => {
      findAll.mockRejectedValue(new Error("db down"));
      const req = mockReq();
      const res = mockRes();

      await getMyHikes(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to retrieve hikes" });
    });
  });

  describe("closeHike", () => {
    function mockHike({ hikerId = 7, status = "ONGOING" } = {}) {
      return { hikerId, status };
    }

    it("rejects a non-numeric id", async () => {
      const req = mockReq({ params: { id: "abc" } });
      const res = mockRes();

      await closeHike(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid hike id" });
      expect(update).not.toHaveBeenCalled();
    });

    it("closes the hiker's own ongoing hike atomically", async () => {
      const hike = mockHike({ hikerId: 7, status: "RETURNED" });
      update.mockResolvedValue([1]);
      findByPk.mockResolvedValue(hike);
      const req = mockReq({ params: { id: "1" }, sessionUserId: 7 });
      const res = mockRes();

      await closeHike(req, res);

      expect(update).toHaveBeenCalledWith(
        { status: "RETURNED" },
        { where: { id: 1, hikerId: 7, status: "ONGOING" } },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(hike);
    });

    it("returns 404 when the hike doesn't exist", async () => {
      update.mockResolvedValue([0]);
      findByPk.mockResolvedValue(null);
      const req = mockReq({ params: { id: "1" }, sessionUserId: 7 });
      const res = mockRes();

      await closeHike(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Hike not found" });
    });

    it("returns 404 when the hike belongs to another hiker", async () => {
      update.mockResolvedValue([0]);
      findByPk.mockResolvedValue(mockHike({ hikerId: 99 }));
      const req = mockReq({ params: { id: "1" }, sessionUserId: 7 });
      const res = mockRes();

      await closeHike(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Hike not found" });
    });

    it("returns 409 when the hike is already closed", async () => {
      update.mockResolvedValue([0]);
      findByPk.mockResolvedValue(mockHike({ hikerId: 7, status: "RETURNED" }));
      const req = mockReq({ params: { id: "1" }, sessionUserId: 7 });
      const res = mockRes();

      await closeHike(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "Hike is already closed" });
    });

    it("returns 500 when the query fails", async () => {
      update.mockRejectedValue(new Error("db down"));
      const req = mockReq({ params: { id: "1" } });
      const res = mockRes();

      await closeHike(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to close hike" });
    });
  });
});
