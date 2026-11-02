import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBookingForHiker } = vi.hoisted(() => ({
  createBookingForHiker: vi.fn(),
}));

vi.mock("../../src/services/bookingService.js", () => {
  class BookingError extends Error {
    constructor(status, message) {
      super(message);
      this.name = "BookingError";
      this.status = status;
    }
  }
  return { createBookingForHiker, BookingError };
});

const { notifyBookingConfirmed } = vi.hoisted(() => ({
  notifyBookingConfirmed: vi.fn(),
}));

vi.mock("../../src/services/bookingNotifications.js", () => ({
  notifyBookingConfirmed,
}));

import { createBooking } from "../../src/controllers/bookingController.js";
import { BookingError } from "../../src/services/bookingService.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(body) {
  return { body, session: { user: { id: 7 } } };
}

describe("createBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    notifyBookingConfirmed.mockResolvedValue(true);
  });

  it("rejects a missing or malformed body", async () => {
    const res = mockRes();
    await createBooking(mockReq(null), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid request body" });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("rejects an array body", async () => {
    const res = mockRes();
    await createBooking(mockReq([1, 2]), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid request body" });
  });

  it("rejects an invalid slotId", async () => {
    const res = mockRes();
    await createBooking(mockReq({ slotId: 0, numberOfPeople: 2 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "slotId must be a positive integer" });
  });

  it("rejects an invalid numberOfPeople", async () => {
    const res = mockRes();
    await createBooking(mockReq({ slotId: 1, numberOfPeople: -1 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "numberOfPeople must be a positive integer" });
  });

  it("rejects a non-boolean allergyFlag", async () => {
    const res = mockRes();
    await createBooking(mockReq({ slotId: 1, numberOfPeople: 2, allergyFlag: "no" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "allergyFlag must be a boolean" });
  });

  it("rejects a non-string allergyDescription", async () => {
    const res = mockRes();
    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, allergyFlag: false, allergyDescription: 42 }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid allergyDescription" });
  });

  it("rejects a missing allergyDescription when allergyFlag is true", async () => {
    const res = mockRes();
    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, allergyFlag: true, allergyDescription: "   " }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Allergy description is required" });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("creates the booking, notifies the hiker and returns 201", async () => {
    const booking = { id: 5, hikerId: 7, slotId: 1, numberOfPeople: 2, status: "CONFIRMED", tables: [] };
    createBookingForHiker.mockResolvedValue(booking);
    const res = mockRes();

    await createBooking(mockReq({ slotId: 1, numberOfPeople: 2 }), res);

    expect(createBookingForHiker).toHaveBeenCalledWith({
      hikerId: 7,
      slotId: 1,
      numberOfPeople: 2,
      allergyFlag: false,
      allergyDescription: null,
    });
    expect(notifyBookingConfirmed).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(booking);
  });

  it("trims the allergy description and forwards it when allergyFlag is true", async () => {
    createBookingForHiker.mockResolvedValue({ id: 6 });
    const res = mockRes();

    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, allergyFlag: true, allergyDescription: "  nuts  " }),
      res,
    );

    expect(createBookingForHiker).toHaveBeenCalledWith(
      expect.objectContaining({ allergyFlag: true, allergyDescription: "nuts" }),
    );
  });

  it("still returns 201 when the confirmation email fails to send", async () => {
    const booking = { id: 8 };
    createBookingForHiker.mockResolvedValue(booking);
    notifyBookingConfirmed.mockRejectedValue(new Error("SMTP down"));
    const res = mockRes();

    await createBooking(mockReq({ slotId: 1, numberOfPeople: 2 }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(booking);
  });

  it("maps a BookingError from the service to its status and message", async () => {
    createBookingForHiker.mockRejectedValue(new BookingError(409, "Slot is not available"));
    const res = mockRes();

    await createBooking(mockReq({ slotId: 1, numberOfPeople: 2 }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Slot is not available" });
  });

  it("returns 400 for a Sequelize validation error", async () => {
    const error = new Error("bad data");
    error.name = "SequelizeValidationError";
    createBookingForHiker.mockRejectedValue(error);
    const res = mockRes();

    await createBooking(mockReq({ slotId: 1, numberOfPeople: 2 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid booking data" });
  });

  it("returns 500 for an unexpected error", async () => {
    createBookingForHiker.mockRejectedValue(new Error("boom"));
    const res = mockRes();

    await createBooking(mockReq({ slotId: 1, numberOfPeople: 2 }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to create booking" });
  });
});
