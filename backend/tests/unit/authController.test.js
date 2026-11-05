import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findOne, create } = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
}));

const { hashPassword, verifyPassword } = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../../src/services/authService.js", () => ({
  hashPassword,
  verifyPassword,
}));

import { createAuthController } from "../../src/controllers/authController.js";

const { register, login, logout, getMe } = createAuthController({
  User: { findOne, create },
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
};

const validRegisterBody = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  password: "secret1",
  phone: "3331234567",
};

describe("Auth Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("registers a hiker and stores the session", async () => {
      findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashed");
      const created = { id: 1, firstName: "John", lastName: "Doe", email: "john@example.com", role: "HIKER" };
      create.mockResolvedValue(created);
      const req = { body: validRegisterBody, session: {} };
      const res = mockRes();

      await register(req, res);

      expect(req.session.user).toEqual({ id: 1, role: "HIKER" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("returns 500 when a database error occurs", async () => {
      findOne.mockRejectedValue(new Error("db down"));
      const req = { body: validRegisterBody, session: {} };
      const res = mockRes();

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal error while registering user" });
    });
  });

  describe("login", () => {
    it("rejects an unknown email", async () => {
      findOne.mockResolvedValue(null);
      const req = { body: { email: "nobody@example.com", password: "secret1" }, session: {} };
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials" });
    });

    it("logs the hiker in and stores the session", async () => {
      findOne.mockResolvedValue({ id: 1, firstName: "John", lastName: "Doe", role: "HIKER", passwordHash: "hashed" });
      verifyPassword.mockResolvedValue(true);
      const req = { body: { email: "john@example.com", password: "secret1" }, session: {} };
      const res = mockRes();

      await login(req, res);

      expect(req.session.user).toEqual({ id: 1, role: "HIKER" });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("logout", () => {
    it("clears the session cookie on success", () => {
      const req = { session: { destroy: vi.fn((cb) => cb(null)) } };
      const res = mockRes();

      logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith("connect.sid");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("returns 500 when the session cannot be destroyed", () => {
      const req = { session: { destroy: vi.fn((cb) => cb(new Error("store down"))) } };
      const res = mockRes();

      logout(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Could not log out" });
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe("getMe", () => {
    it("returns 401 when there is no session user", () => {
      const req = { session: {} };
      const res = mockRes();

      getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized: Authentication required" });
    });

    it("returns 401 when there is no session at all", () => {
      const req = {};
      const res = mockRes();

      getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns the session user when present", () => {
      const sessionUser = { id: 1, role: "HIKER" };
      const req = { session: { user: sessionUser } };
      const res = mockRes();

      getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sessionUser);
    });
  });
});
