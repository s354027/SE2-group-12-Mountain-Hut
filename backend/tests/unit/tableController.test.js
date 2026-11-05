import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createTableController } from "../../src/controllers/tableController.js";

const { findAll, findOne, create, findByPk, slotTableCount, bookingTableCount } =
  vi.hoisted(() => ({
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findByPk: vi.fn(),
    slotTableCount: vi.fn(),
    bookingTableCount: vi.fn(),
  }));

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = ({ body = undefined, params = {} } = {}) => ({
  body,
  params,
});

const { getTables, createTable, updateTable, deleteTable } = createTableController({
  DiningTable: { findAll, findOne, create, findByPk },
  SlotTable: { count: slotTableCount },
  BookingTable: { count: bookingTableCount },
});

describe("Table Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTables", () => {
    it("returns the list of tables ordered by tableNumber", async () => {
      const tables = [{ id: 1, tableNumber: 1, seats: 2 }];
      findAll.mockResolvedValue(tables);
      const req = mockReq();
      const res = mockRes();

      await getTables(req, res);

      expect(findAll).toHaveBeenCalledWith({ order: [["tableNumber", "ASC"]] });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(tables);
    });

    it("returns 500 when the query fails", async () => {
      findAll.mockRejectedValue(new Error("db down"));
      const req = mockReq();
      const res = mockRes();

      await getTables(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to retrieve tables" });
    });
  });

  describe("createTable", () => {
    it("rejects a non-integer tableNumber", async () => {
      const req = mockReq({ body: { tableNumber: "abc", seats: 4 } });
      const res = mockRes();

      await createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "tableNumber must be a positive integer" });
      expect(findOne).not.toHaveBeenCalled();
    });

    it("rejects a tableNumber below 1", async () => {
      const req = mockReq({ body: { tableNumber: 0, seats: 4 } });
      const res = mockRes();

      await createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "tableNumber must be a positive integer" });
    });

    it("rejects an invalid seats value", async () => {
      const req = mockReq({ body: { tableNumber: 1, seats: 0 } });
      const res = mockRes();

      await createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "seats must be a positive integer" });
    });

    it("rejects a duplicate tableNumber", async () => {
      findOne.mockResolvedValue({ id: 5, tableNumber: 3 });
      const req = mockReq({ body: { tableNumber: 3, seats: 4 } });
      const res = mockRes();

      await createTable(req, res);

      expect(findOne).toHaveBeenCalledWith({ where: { tableNumber: 3 } });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "A table with this number already exists" });
      expect(create).not.toHaveBeenCalled();
    });

    it("creates the table and returns 201", async () => {
      findOne.mockResolvedValue(null);
      const created = { id: 9, tableNumber: 3, seats: 4 };
      create.mockResolvedValue(created);
      const req = mockReq({ body: { tableNumber: 3, seats: 4 } });
      const res = mockRes();

      await createTable(req, res);

      expect(create).toHaveBeenCalledWith({ tableNumber: 3, seats: 4 });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("returns 500 when creation fails", async () => {
      findOne.mockResolvedValue(null);
      create.mockRejectedValue(new Error("db down"));
      const req = mockReq({ body: { tableNumber: 3, seats: 4 } });
      const res = mockRes();

      await createTable(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to create table" });
    });
  });

  describe("updateTable", () => {
    it("returns 404 when the table does not exist", async () => {
      findByPk.mockResolvedValue(null);
      const req = mockReq({ params: { id: 1 }, body: { seats: 6 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Table not found" });
    });

    it("rejects an invalid tableNumber", async () => {
      findByPk.mockResolvedValue({ id: 1, tableNumber: 2, seats: 4, update: vi.fn() });
      const req = mockReq({ params: { id: 1 }, body: { tableNumber: -1 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "tableNumber must be a positive integer" });
    });

    it("rejects a tableNumber already used by another table", async () => {
      findByPk.mockResolvedValue({ id: 1, tableNumber: 2, seats: 4, update: vi.fn() });
      findOne.mockResolvedValue({ id: 2, tableNumber: 5 });
      const req = mockReq({ params: { id: 1 }, body: { tableNumber: 5 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(findOne).toHaveBeenCalledWith({ where: { tableNumber: 5 } });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "A table with this number already exists" });
    });

    it("skips the duplicate check when tableNumber is unchanged", async () => {
      const update = vi.fn().mockResolvedValue();
      findByPk.mockResolvedValue({ id: 1, tableNumber: 2, seats: 4, update });
      const req = mockReq({ params: { id: 1 }, body: { tableNumber: 2, seats: 6 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(findOne).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({ tableNumber: 2, seats: 6 });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects an invalid seats value", async () => {
      findByPk.mockResolvedValue({ id: 1, tableNumber: 2, seats: 4, update: vi.fn() });
      const req = mockReq({ params: { id: 1 }, body: { seats: -3 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "seats must be a positive integer" });
    });

    it("updates only the provided fields and returns 200", async () => {
      const table = { id: 1, tableNumber: 2, seats: 4, update: vi.fn().mockResolvedValue() };
      findByPk.mockResolvedValue(table);
      const req = mockReq({ params: { id: 1 }, body: { seats: 8 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(table.update).toHaveBeenCalledWith({ seats: 8 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(table);
    });

    it("returns 500 when the update fails", async () => {
      findByPk.mockRejectedValue(new Error("db down"));
      const req = mockReq({ params: { id: 1 }, body: { seats: 8 } });
      const res = mockRes();

      await updateTable(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to update table" });
    });
  });

  describe("deleteTable", () => {
    it("returns 404 when the table does not exist", async () => {
      findByPk.mockResolvedValue(null);
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await deleteTable(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Table not found" });
    });

    it("refuses to delete a table assigned to a slot", async () => {
      findByPk.mockResolvedValue({ id: 1, destroy: vi.fn() });
      slotTableCount.mockResolvedValue(2);
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await deleteTable(req, res);

      expect(slotTableCount).toHaveBeenCalledWith({ where: { tableId: 1 } });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Cannot delete a table that is assigned to one or more slots",
      });
      expect(bookingTableCount).not.toHaveBeenCalled();
    });

    it("refuses to delete a table linked to a booking", async () => {
      findByPk.mockResolvedValue({ id: 1, destroy: vi.fn() });
      slotTableCount.mockResolvedValue(0);
      bookingTableCount.mockResolvedValue(1);
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await deleteTable(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Cannot delete a table that is linked to existing bookings",
      });
    });

    it("deletes the table and returns 204", async () => {
      const destroy = vi.fn().mockResolvedValue();
      findByPk.mockResolvedValue({ id: 1, destroy });
      slotTableCount.mockResolvedValue(0);
      bookingTableCount.mockResolvedValue(0);
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await deleteTable(req, res);

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("returns 500 when deletion fails", async () => {
      findByPk.mockRejectedValue(new Error("db down"));
      const req = mockReq({ params: { id: 1 } });
      const res = mockRes();

      await deleteTable(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to delete table" });
    });
  });
});
