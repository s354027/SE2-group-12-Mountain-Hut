import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createSlotController } from "../../src/controllers/slotController.js";

const { findAll, findByPk, create, findAllTables, bookingCount } = vi.hoisted(
  () => ({
    findAll: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
    findAllTables: vi.fn(),
    bookingCount: vi.fn(),
  }),
);

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = ({ body = undefined, query = {}, params = {} } = {}) => ({
  body,
  query,
  params,
});

const {
  createSlot,
  getSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
  copyTablesFromSlot,
} = createSlotController({
  Slot: { findAll, findByPk, create },
  DiningTable: { findAll: findAllTables },
  Booking: { count: bookingCount },
});

describe("Slot Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return all slots when getSlots is called", async () => {
    const mockSlots = [{ id: 1 }, { id: 2 }];
    findAll.mockResolvedValue(mockSlots);
    const req = mockReq();
    const res = mockRes();

    await getSlots(req, res);

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockSlots);
  });

  it("should return 500 when an error occurs in getSlots", async () => {
    findAll.mockRejectedValue(new Error("Database error"));
    const req = mockReq();
    const res = mockRes();

    await getSlots(req, res);

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to retrieve slots",
    });
  });

  it("should use meal and date filters when provided in getSlots", async () => {
    const mockSlots = [{ id: 1 }];
    findAll.mockResolvedValue(mockSlots);
    const req = mockReq({ query: { meal: "LUNCH", date: "2024-06-01" } });
    const res = mockRes();

    await getSlots(req, res);

    expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            meal: "LUNCH",
            date: "2024-06-01",
          }),
        }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockSlots);
  });

  it("should return 404 when slot is not found in getSlotById", async () => {
    findByPk.mockResolvedValue(null);
    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    await getSlotById(req, res);

    expect(findByPk).toHaveBeenCalledWith("42", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Slot not found" });
  });

  it("should return 500 when an error occurs in getSlotById", async () => {
    findByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    await getSlotById(req, res);

    expect(findByPk).toHaveBeenCalledWith("42", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to retrieve slot" });
  });

  it("should return the slot when found in getSlotById", async () => {
    const mockSlot = { id: 42 };
    findByPk.mockResolvedValue(mockSlot);
    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    await getSlotById(req, res);

    expect(findByPk).toHaveBeenCalledWith("42", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockSlot);
  });

  it("should return 400 when no date is provided in createSlot", async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "date, startTime, duration, and meal are required fields",
    });
  });

  it("should return 400 when no startTime is provided in createSlot", async () => {
    const req = mockReq({ body: { date: "2024-06-01" } });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "date, startTime, duration, and meal are required fields",
    });
  });

  it("should return 400 when no duration is provided in createSlot", async () => {
    const req = mockReq({ body: { date: "2024-06-01", startTime: "12:00" } });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "date, startTime, duration, and meal are required fields",
    });
  });

  it("should return 400 when no meal is provided in createSlot", async () => {
    const req = mockReq({
      body: { date: "2024-06-01", startTime: "12:00", duration: 60 },
    });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "date, startTime, duration, and meal are required fields",
    });
  });

  it("returns 400 if meal is not LUNCH or DINNER in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "BREAKFAST",
      },
    });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "meal must be LUNCH or DINNER",
    });
  });

  it("should return 400 when duration is not a number in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: "sixty",
        meal: "LUNCH",
      },
    });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "duration must be a positive integer (minutes)",
    });
  });

  it("should return 400 when duration is not a positive integer in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: -30,
        meal: "LUNCH",
      },
    });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "duration must be a positive integer (minutes)",
    });
  });

  it("should return 400 when table capacity is not a positive integer in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        totalCapacity: -4,
      },
    });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "totalCapacity must be specified or calculated from assigned tables",
    });
  });

  it("should return 400 when table length is different from the tables in the database", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        totalCapacity: 4,
        status: null,
        tableIds: [1, 2, 3, 4],
      },
    });
    const res = mockRes();

    findAllTables.mockResolvedValue([{ id: 1 }, { id: 2 }]); // Simulate fewer tables in the database

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "One or more tableIds are invalid",
    });
  });

  it("should return 400 when totalCapacity is negative in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        totalCapacity: -4,
      },
    });
    const res = mockRes();

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "totalCapacity must be specified or calculated from assigned tables",
    });
  });

  it("should assume totalCapacity from tableIds if not provided in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        tableIds: [1, 2],
      },
    });
    const res = mockRes();

    findAllTables.mockResolvedValue([
      { id: 1, seats: 2 },
      { id: 2, seats: 4 },
    ]); // Simulate tables in the database
    create.mockResolvedValue({ id: 10, setTables: vi.fn() });
    findByPk.mockResolvedValue({ id: 10, totalCapacity: 6 });

    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalCapacity: 6 }),
    );
  });

  it("should create a slot successfully when all required fields are provided", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        totalCapacity: 4,
      },
    });
    const res = mockRes();

    create.mockResolvedValue({ id: 10, setTables: vi.fn() });
    findByPk.mockResolvedValue({ id: 10 });

    await createSlot(req, res);
    expect(create).toHaveBeenCalledWith({
      date: "2024-06-01",
      startTime: "12:00",
      duration: 60,
      meal: "LUNCH",
      totalCapacity: 4,
      status: "OPEN",
    });
  });

  it("should return 400 if source slot is not found when copying a slot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        sourceSlotId: 999, // Non-existent slot ID
      },
    });
    const res = mockRes();

    findByPk.mockResolvedValue(null); // Simulate source slot not found

    await createSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith(999, expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Source slot not found",
    });
  });

  it("should return 400 if source slot has no tables assigned when copying a slot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        sourceSlotId: 1,
      },
    });
    const res = mockRes();

    findByPk.mockResolvedValue({
      id: 1,
      getTables: vi.fn().mockResolvedValue([]), // Simulate no tables assigned
    });

    await createSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith(1, expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Selected source slot has no tables assigned",
    });
  });

  it("should use source slot tables and totalCapacity when copying a slot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        sourceSlotId: 1,
      },
    });
    const res = mockRes();

    const mockSourceSlot = {
      id: 1,
      tables: [
        { id: 1, seats: 2 },
        { id: 2, seats: 4 },
      ],
    };
    const newSlot = { id: 10, setTables: vi.fn() };

    findByPk
      .mockResolvedValueOnce(mockSourceSlot)
      .mockResolvedValueOnce({ id: 10 });
    create.mockResolvedValue(newSlot);

    await createSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith(1, expect.any(Object));
    expect(create).toHaveBeenCalledWith({
      date: "2024-06-01",
      startTime: "12:00",
      duration: 60,
      meal: "LUNCH",
      totalCapacity: 6, // 2 + 4 from source slot tables
      status: "OPEN",
    });

    expect(newSlot.setTables).toHaveBeenCalledWith([
      { id: 1, seats: 2 },
      { id: 2, seats: 4 },
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should return 500 when an error occurs in createSlot", async () => {
    const req = mockReq({
      body: {
        date: "2024-06-01",
        startTime: "12:00",
        duration: 60,
        meal: "LUNCH",
        totalCapacity: 4,
      },
    });
    const res = mockRes();

    create.mockRejectedValue(new Error("Database error"));
    await createSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to create slot" });
  });

  it("should return 404 when updating a slot that does not exist", async () => {
    findByPk.mockResolvedValue(null);
    const req = mockReq({
      params: { id: "42" },
      body: { status: "CLOSED" },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Slot not found" });
  });

  it("should reject an invalid duration when updating a slot", async () => {
    const slot = { update: vi.fn() };
    findByPk.mockResolvedValue(slot);
    const req = mockReq({
      params: { id: "42" },
      body: { duration: "invalid" },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "duration must be a positive integer",
    });
    expect(slot.update).not.toHaveBeenCalled();
  });

  it("should reject an invalid meal when updating a slot", async () => {
    const slot = { update: vi.fn() };
    findByPk.mockResolvedValue(slot);
    const req = mockReq({
      params: { id: "42" },
      body: { meal: "BREAKFAST" },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "meal must be LUNCH or DINNER",
    });
    expect(slot.update).not.toHaveBeenCalled();
  });

  it("should update slot fields and return the updated slot", async () => {
    const slot = { id: 42, update: vi.fn() };
    const updatedSlot = { id: 42, status: "CLOSED" };
    findByPk.mockResolvedValueOnce(slot).mockResolvedValueOnce(updatedSlot);
    const req = mockReq({
      params: { id: "42" },
      body: {
        date: "2024-06-02",
        startTime: "13:00",
        duration: "90",
        meal: "dinner",
        status: "CLOSED",
        totalCapacity: 8,
      },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(slot.update).toHaveBeenCalledWith({
      date: "2024-06-02",
      startTime: "13:00",
      duration: 90,
      meal: "DINNER",
      status: "CLOSED",
      totalCapacity: 8,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedSlot);
  });

  it("should update tables and calculate capacity when tableIds are provided", async () => {
    const slot = { id: 42, update: vi.fn(), setTables: vi.fn() };
    const tables = [
      { id: 1, seats: 2 },
      { id: 2, seats: 4 },
    ];
    const updatedSlot = { id: 42, totalCapacity: 6 };
    findByPk.mockResolvedValueOnce(slot).mockResolvedValueOnce(updatedSlot);
    findAllTables.mockResolvedValue(tables);
    const req = mockReq({
      params: { id: "42" },
      body: { tableIds: [1, 2] },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(slot.setTables).toHaveBeenCalledWith(tables);
    expect(slot.update).toHaveBeenCalledWith({ totalCapacity: 6 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedSlot);
  });

  it("should use explicit totalCapacity when updating tables", async () => {
    const slot = { id: 42, update: vi.fn(), setTables: vi.fn() };
    const tables = [
      { id: 1, seats: 2 },
      { id: 2, seats: 4 },
    ];
    const updatedSlot = { id: 42, totalCapacity: 10 };
    findByPk.mockResolvedValueOnce(slot).mockResolvedValueOnce(updatedSlot);
    findAllTables.mockResolvedValue(tables);
    const req = mockReq({
      params: { id: "42" },
      body: { tableIds: [1, 2], totalCapacity: "10" },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(slot.setTables).toHaveBeenCalledWith(tables);
    expect(slot.update).toHaveBeenCalledWith({ totalCapacity: 10 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedSlot);
  });

  it("should return 400 when an update contains invalid tableIds", async () => {
    const slot = { id: 42, update: vi.fn(), setTables: vi.fn() };
    findByPk.mockResolvedValue(slot);
    findAllTables.mockResolvedValue([{ id: 1, seats: 2 }]);
    const req = mockReq({
      params: { id: "42" },
      body: { tableIds: [1, 2] },
    });
    const res = mockRes();

    await updateSlot(req, res);

    expect(findAllTables).toHaveBeenCalledWith({
      where: { id: expect.any(Object) },
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "One or more tableIds are invalid",
    });
    expect(slot.setTables).not.toHaveBeenCalled();
    expect(slot.update).not.toHaveBeenCalled();
  });

  it("should return 404 when slot is not found in updateSlot", async () => {
    findByPk.mockResolvedValue(null);
    const req = mockReq({ params: { id: "42" }, body: { meal: "DINNER" } });
    const res = mockRes();

    await updateSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Slot not found" });
  });

  it("shoudl return 400 if duration is not a positive integer in updateSlot", async () => {
    const req = mockReq({
      params: { id: "42" },
      body: { duration: -30 },
    });
    const res = mockRes();

    findByPk.mockResolvedValue({ id: 42, update: vi.fn() });

    await updateSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "duration must be a positive integer",
    });
  });

  it("should return 404 if not slot is found in deleteSlot", async () => {
    findByPk.mockResolvedValue(null);
    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    await deleteSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Slot not found" });
  });

  it("should delete a slot successfully", async () => {
    const slot = { id: 42, destroy: vi.fn() };
    findByPk.mockResolvedValue(slot);
    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    bookingCount.mockResolvedValue(0); // Simulate no bookings for the slot

    await deleteSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(slot.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  it("should return 400 if slot has bookings and cannot be deleted", async () => {
    const slot = { id: 42, destroy: vi.fn() };
    findByPk.mockResolvedValue(slot);
    bookingCount.mockResolvedValue(5);

    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    await deleteSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(bookingCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          slotId: "42",
          status: expect.any(Object),
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Cannot delete slot with active bookings",
    });
    expect(slot.destroy).not.toHaveBeenCalled();
  });

  it("should return 500 when an error occurs in deleteSlot", async () => {
    const slot = { id: 42, destroy: vi.fn() };
    findByPk.mockResolvedValue(slot);
    bookingCount.mockRejectedValue(new Error("Database error"));

    const req = mockReq({ params: { id: "42" } });
    const res = mockRes();

    await deleteSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(slot.destroy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to delete slot",
    });
  });

  it("should return 500 when an error occurs in updateSlot", async () => {
    const slot = { id: 42, update: vi.fn() };
    findByPk.mockResolvedValue(slot);
    slot.update.mockRejectedValue(new Error("Database error"));

    const req = mockReq({ params: { id: "42" }, body: { status: "CLOSED" } });
    const res = mockRes();

    await updateSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith("42");
    expect(slot.update).toHaveBeenCalledWith({ status: "CLOSED" });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to update slot",
    });
  });

  it("should return 400 when slot id is not provided in copyTablesFromSlot", async () => {
    const req = mockReq({ params: { id: 41 }, body: { sourceSlotId: null } });
    const res = mockRes();

    await copyTablesFromSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "sourceSlotId is required",
    });
  });

  it("should return 404 when the target slot is not found", async () => {
    findByPk.mockResolvedValue(null);
    const req = mockReq({ params: { id: 41 }, body: { sourceSlotId: 12 } });
    const res = mockRes();

    await copyTablesFromSlot(req, res);

    expect(findByPk).toHaveBeenCalledWith(41);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Target slot not found",
    });
  });

  it("should return 404 when the source slot is not found", async () => {
    const targetSlot = { id: 41, setTables: vi.fn(), update: vi.fn() };
    findByPk.mockResolvedValueOnce(targetSlot).mockResolvedValueOnce(null);
    const req = mockReq({ params: { id: 41 }, body: { sourceSlotId: 12 } });
    const res = mockRes();

    await copyTablesFromSlot(req, res);

    expect(findByPk).toHaveBeenNthCalledWith(1, 41);
    expect(findByPk).toHaveBeenNthCalledWith(2, 12, expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Source slot not found",
    });
  });

  it("should return 400 when the source slot has no assigned tables", async () => {
    const targetSlot = { id: 41, setTables: vi.fn(), update: vi.fn() };
    findByPk
      .mockResolvedValueOnce(targetSlot)
      .mockResolvedValueOnce({ id: 12, tables: [] });
    const req = mockReq({ params: { id: 41 }, body: { sourceSlotId: 12 } });
    const res = mockRes();

    await copyTablesFromSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Source slot has no assigned tables to copy",
    });
    expect(targetSlot.setTables).not.toHaveBeenCalled();
    expect(targetSlot.update).not.toHaveBeenCalled();
  });

  it("should copy source tables and recalculate target capacity", async () => {
    const sourceTables = [
      { id: 1, seats: 2 },
      { id: 2, seats: 4 },
    ];
    const targetSlot = { id: 41, setTables: vi.fn(), update: vi.fn() };
    const updatedSlot = { id: 41, totalCapacity: 6, tables: sourceTables };
    findByPk
      .mockResolvedValueOnce(targetSlot)
      .mockResolvedValueOnce({ id: 12, tables: sourceTables })
      .mockResolvedValueOnce(updatedSlot);
    const req = mockReq({ params: { id: 41 }, body: { sourceSlotId: 12 } });
    const res = mockRes();

    await copyTablesFromSlot(req, res);

    expect(targetSlot.setTables).toHaveBeenCalledWith(sourceTables);
    expect(targetSlot.update).toHaveBeenCalledWith({ totalCapacity: 6 });
    expect(findByPk).toHaveBeenNthCalledWith(3, 41, expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedSlot);
  });

  it("should return 500 when copying tables fails", async () => {
    findByPk.mockRejectedValue(new Error("Database error"));
    const req = mockReq({ params: { id: 41 }, body: { sourceSlotId: 12 } });
    const res = mockRes();

    await copyTablesFromSlot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to copy tables from slot",
    });
  });
});
