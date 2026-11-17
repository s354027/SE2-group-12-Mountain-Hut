import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBookingForHiker, getBookingForHiker, listBookingsForHiker } = vi.hoisted(() => ({
  createBookingForHiker: vi.fn(),
  getBookingForHiker: vi.fn(),
  listBookingsForHiker: vi.fn(),
}));

vi.mock("../../src/services/bookingService.js", () => {
  class BookingError extends Error {
    constructor(status, message) {
      super(message);
      this.name = "BookingError";
      this.status = status;
    }
  }
  return { createBookingForHiker, getBookingForHiker, listBookingsForHiker, BookingError };
});

const { notifyBookingConfirmed } = vi.hoisted(() => ({
  notifyBookingConfirmed: vi.fn(),
}));

vi.mock("../../src/services/bookingNotifications.js", () => ({
  notifyBookingConfirmed,
}));

import { createBooking, getBooking, listBookings } from "../../src/controllers/bookingController.js";
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

function mockReqWithParams(params) {
  return { params, session: { user: { id: 7 } } };
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
      dietaryRequirements: [],
    });
    expect(notifyBookingConfirmed).toHaveBeenCalledWith(5);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(booking);
  });

  it("forwards a valid dietaryRequirements list", async () => {
    createBookingForHiker.mockResolvedValue({ id: 8 });
    const res = mockRes();

    const dietaryRequirements = [
      { allergies: true, description: "1 vegan, peanut allergy" },
      { allergies: false, description: "2 vegetarians" },
    ];

    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, dietaryRequirements }),
      res,
    );

    expect(createBookingForHiker).toHaveBeenCalledWith(
      expect.objectContaining({ dietaryRequirements }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects a non-array dietaryRequirements", async () => {
    const res = mockRes();

    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, dietaryRequirements: "vegetarian" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "dietaryRequirements must be an array" });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry that is not an object", async () => {
    const res = mockRes();

    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, dietaryRequirements: ["vegetarian"] }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Each dietary requirement must be an object" });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry with a non-boolean allergies flag", async () => {
    const res = mockRes();

    await createBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        dietaryRequirements: [{ allergies: "yes", description: "vegetarian" }],
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Each dietary requirement must have an allergies boolean" });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry with a blank description", async () => {
    const res = mockRes();

    await createBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        dietaryRequirements: [{ allergies: false, description: "   " }],
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Each dietary requirement must have a non-empty description" });
    expect(createBookingForHiker).not.toHaveBeenCalled();
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

describe("getBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects a non-numeric id", async () => {
    const res = mockRes();
    await getBooking(mockReqWithParams({ id: "abc" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "bookingId must be a positive integer" });
    expect(getBookingForHiker).not.toHaveBeenCalled();
  });

  it("fetches the booking for the authenticated hiker and returns 200", async () => {
    const booking = { id: 5, hikerId: 7, slotId: 1, numberOfPeople: 2, status: "CONFIRMED", slot: null, tables: [] };
    getBookingForHiker.mockResolvedValue(booking);
    const res = mockRes();

    await getBooking(mockReqWithParams({ id: "5" }), res);

    expect(getBookingForHiker).toHaveBeenCalledWith({ bookingId: 5, hikerId: 7 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(booking);
  });

  it("maps a BookingError from the service to its status and message", async () => {
    getBookingForHiker.mockRejectedValue(new BookingError(403, "Cannot view another hiker booking"));
    const res = mockRes();

    await getBooking(mockReqWithParams({ id: "5" }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Cannot view another hiker booking" });
  });

  it("returns 500 for an unexpected error", async () => {
    getBookingForHiker.mockRejectedValue(new Error("boom"));
    const res = mockRes();

    await getBooking(mockReqWithParams({ id: "5" }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to retrieve booking" });
  });
});

describe("listBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lists the authenticated hiker's bookings and returns 200", async () => {
    const bookings = [{ id: 5 }, { id: 6 }];
    listBookingsForHiker.mockResolvedValue(bookings);
    const res = mockRes();

    await listBookings(mockReq(undefined), res);

    expect(listBookingsForHiker).toHaveBeenCalledWith({ hikerId: 7 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(bookings);
  });

  it("returns 500 for an unexpected error", async () => {
    listBookingsForHiker.mockRejectedValue(new Error("boom"));
    const res = mockRes();

    await listBookings(mockReq(undefined), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to retrieve bookings" });
  });
});
