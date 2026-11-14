import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findOne, create, findByPk, tokenCreate, tokenDestroy, tokenFindOne } = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  findByPk: vi.fn(),
  tokenCreate: vi.fn(),
  tokenDestroy: vi.fn(),
  tokenFindOne: vi.fn(),
}));

const { sendPasswordResetEmail } = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../../src/services/emailService.js", () => ({
  sendPasswordResetEmail,
}));

const { hashPassword, verifyPassword } = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../../src/services/authService.js", () => ({
  hashPassword,
  verifyPassword,
  generateResetToken: () => "plain-token",
  hashToken: (token) => `hash(${token})`,
  RESET_TOKEN_TTL_MS: 24 * 60 * 60 * 1000,
  MIN_PASSWORD_LENGTH: 6,
}));

import { createAuthController } from "../../src/controllers/authController.js";

const { register, login, logout, getMe, changePassword, forgotPassword, resetPassword } = createAuthController({
  User: { findOne, create, findByPk },
  PasswordResetToken: { create: tokenCreate, destroy: tokenDestroy, findOne: tokenFindOne },
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
      expect(res.json.mock.calls[0][0].mustChangePassword).toBe(false);
    });

    it("refuses temporary hikers created by an employee (MH-07)", async () => {
      findOne.mockResolvedValue({ id: 2, role: "HIKER", isTemporary: true, passwordHash: "hashed" });
      verifyPassword.mockResolvedValue(true);
      const req = { body: { email: "temp@example.com", password: "secret1" }, session: {} };
      const res = mockRes();

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(req.session.user).toBeUndefined();
    });

    it("flags the session when the password must be changed (MH-07)", async () => {
      findOne.mockResolvedValue({ id: 3, firstName: "Luca", lastName: "Verdi", role: "HIKER", mustChangePassword: true, passwordHash: "hashed" });
      verifyPassword.mockResolvedValue(true);
      const req = { body: { email: "luca@example.com", password: "random" }, session: {} };
      const res = mockRes();

      await login(req, res);

      expect(req.session.user).toEqual({ id: 3, role: "HIKER", mustChangePassword: true });
      expect(res.json.mock.calls[0][0].mustChangePassword).toBe(true);
    });
  });

  describe("changePassword", () => {
    const session = () => ({ user: { id: 3, role: "HIKER", mustChangePassword: true } });

    it("rejects a too short new password", async () => {
      const res = mockRes();
      await changePassword({ body: { currentPassword: "old-pw", newPassword: "123" }, session: session() }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects a new password equal to the current one", async () => {
      const res = mockRes();
      await changePassword({ body: { currentPassword: "same-pw", newPassword: "same-pw" }, session: session() }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects a wrong current password", async () => {
      findByPk.mockResolvedValue({ id: 3, passwordHash: "hashed" });
      verifyPassword.mockResolvedValue(false);
      const res = mockRes();
      await changePassword({ body: { currentPassword: "wrong", newPassword: "new-pw-1" }, session: session() }, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("updates the password and clears the forced change", async () => {
      const update = vi.fn();
      findByPk.mockResolvedValue({ id: 3, role: "HIKER", passwordHash: "hashed", update });
      verifyPassword.mockResolvedValue(true);
      hashPassword.mockResolvedValue("new-hash");
      const req = { body: { currentPassword: "old-pw", newPassword: "new-pw-1" }, session: session() };
      const res = mockRes();

      await changePassword(req, res);

      expect(update).toHaveBeenCalledWith({ passwordHash: "new-hash", mustChangePassword: false });
      expect(req.session.user).toEqual({ id: 3, role: "HIKER" });
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe("forgotPassword", () => {
    it("requires an email", async () => {
      const res = mockRes();
      await forgotPassword({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("answers 200 without sending anything for unknown or temporary users", async () => {
      for (const user of [null, { id: 2, isTemporary: true }]) {
        findOne.mockResolvedValue(user);
        const res = mockRes();
        await forgotPassword({ body: { email: "x@example.com" } }, res);
        expect(res.status).toHaveBeenCalledWith(200);
      }
      expect(tokenCreate).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("stores only the token hash with a 24h expiry and emails the link", async () => {
      findOne.mockResolvedValue({ id: 5, firstName: "Anna", lastName: "Rossi", email: "anna@example.com" });
      sendPasswordResetEmail.mockResolvedValue(true);
      const before = Date.now();
      const res = mockRes();

      await forgotPassword({ body: { email: " Anna@Example.com " } }, res);

      expect(findOne).toHaveBeenCalledWith({ where: { email: "anna@example.com" } });
      expect(tokenDestroy).toHaveBeenCalledWith({ where: { userId: 5, usedAt: null } });
      const stored = tokenCreate.mock.calls[0][0];
      expect(stored.tokenHash).toBe("hash(plain-token)");
      expect(stored.expiresAt.getTime() - before).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        "anna@example.com",
        "Anna Rossi",
        expect.stringContaining("/reset-password?token=plain-token")
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("resetPassword", () => {
    it("rejects a missing token or a too short password", async () => {
      for (const body of [{ newPassword: "new-pw-1" }, { token: "t", newPassword: "1" }]) {
        const res = mockRes();
        await resetPassword({ body }, res);
        expect(res.status).toHaveBeenCalledWith(400);
      }
    });

    it("rejects an unknown, used or expired token", async () => {
      tokenFindOne.mockResolvedValue(null);
      const res = mockRes();
      await resetPassword({ body: { token: "plain-token", newPassword: "new-pw-1" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired reset link" });
    });

    it("sets the new password and invalidates the token", async () => {
      const tokenUpdate = vi.fn();
      const userUpdate = vi.fn();
      tokenFindOne.mockResolvedValue({ userId: 5, update: tokenUpdate });
      findByPk.mockResolvedValue({ id: 5, update: userUpdate });
      hashPassword.mockResolvedValue("new-hash");
      const res = mockRes();

      await resetPassword({ body: { token: "plain-token", newPassword: "new-pw-1" } }, res);

      expect(tokenFindOne.mock.calls[0][0].where.tokenHash).toBe("hash(plain-token)");
      expect(userUpdate).toHaveBeenCalledWith({ passwordHash: "new-hash", mustChangePassword: false });
      expect(tokenUpdate).toHaveBeenCalledWith({ usedAt: expect.any(Date) });
      expect(res.status).toHaveBeenCalledWith(204);
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
