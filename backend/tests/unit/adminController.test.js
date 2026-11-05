import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findOne, create } = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
}));

const { hashPassword } = vi.hoisted(() => ({
  hashPassword: vi.fn(),
}));

vi.mock("../../src/services/authService.js", () => ({
  hashPassword,
}));

import { createAdminController } from "../../src/controllers/adminController.js";

const { createStaffUser } = createAdminController({
  User: { findOne, create },
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const validBody = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  password: "secret1",
  role: "EMPLOYEE",
};

describe("Admin Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a role other than EMPLOYEE or WARDEN", async () => {
    const req = { body: { ...validBody, role: "HIKER" } };
    const res = mockRes();

    await createStaffUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "The specified role must be EMPLOYEE or WARDEN" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email", async () => {
    findOne.mockResolvedValue({ id: 1 });
    const req = { body: validBody };
    const res = mockRes();

    await createStaffUser(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "A user with this email is already registered" });
  });

  it("creates the staff member and returns it", async () => {
    findOne.mockResolvedValue(null);
    hashPassword.mockResolvedValue("hashed");
    const created = { id: 2, firstName: "Jane", lastName: "Smith", email: "jane@example.com", role: "EMPLOYEE" };
    create.mockResolvedValue(created);
    const req = { body: validBody };
    const res = mockRes();

    await createStaffUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it("returns 500 when a database error occurs", async () => {
    findOne.mockRejectedValue(new Error("db down"));
    const req = { body: validBody };
    const res = mockRes();

    await createStaffUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Error creating staff member" });
  });
});
