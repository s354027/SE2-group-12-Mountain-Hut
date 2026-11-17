import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBookingForHiker, createBookingByStaff } = vi.hoisted(() => ({
  createBookingForHiker: vi.fn(),
  createBookingByStaff: vi.fn(),
}));

vi.mock("../../src/services/bookingService.js", () => {
  class BookingError extends Error {
    constructor(status, message) {
      super(message);
      this.name = "BookingError";
      this.status = status;
    }
  }
  return { createBookingForHiker, createBookingByStaff, BookingError };
});

const { notifyBookingConfirmed } = vi.hoisted(() => ({
  notifyBookingConfirmed: vi.fn(),
}));

vi.mock("../../src/services/bookingNotifications.js", () => ({
  notifyBookingConfirmed,
}));

import {
  createBooking,
  createStaffBooking,
} from "../../src/controllers/bookingController.js";
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
    expect(res.json).toHaveBeenCalledWith({
      error: "slotId must be a positive integer",
    });
  });

  it("rejects an invalid numberOfPeople", async () => {
    const res = mockRes();
    await createBooking(mockReq({ slotId: 1, numberOfPeople: -1 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "numberOfPeople must be a positive integer",
    });
  });

  it("rejects a non-boolean allergyFlag", async () => {
    const res = mockRes();
    await createBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, allergyFlag: "no" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "allergyFlag must be a boolean",
    });
  });

  it("rejects a non-string allergyDescription", async () => {
    const res = mockRes();
    await createBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        allergyFlag: false,
        allergyDescription: 42,
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid allergyDescription",
    });
  });

  it("rejects a missing allergyDescription when allergyFlag is true", async () => {
    const res = mockRes();
    await createBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        allergyFlag: true,
        allergyDescription: "   ",
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Allergy description is required",
    });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("creates the booking, notifies the hiker and returns 201", async () => {
    const booking = {
      id: 5,
      hikerId: 7,
      slotId: 1,
      numberOfPeople: 2,
      status: "CONFIRMED",
      tables: [],
    };
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
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        dietaryRequirements: "vegetarian",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "dietaryRequirements must be an array",
    });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("rejects a dietaryRequirements entry that is not an object", async () => {
    const res = mockRes();

    await createBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        dietaryRequirements: ["vegetarian"],
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Each dietary requirement must be an object",
    });
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
    expect(res.json).toHaveBeenCalledWith({
      error: "Each dietary requirement must have an allergies boolean",
    });
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
    expect(res.json).toHaveBeenCalledWith({
      error: "Each dietary requirement must have a non-empty description",
    });
    expect(createBookingForHiker).not.toHaveBeenCalled();
  });

  it("trims the allergy description and forwards it when allergyFlag is true", async () => {
    createBookingForHiker.mockResolvedValue({ id: 6 });
    const res = mockRes();

    await createBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        allergyFlag: true,
        allergyDescription: "  nuts  ",
      }),
      res,
    );

    expect(createBookingForHiker).toHaveBeenCalledWith(
      expect.objectContaining({
        allergyFlag: true,
        allergyDescription: "nuts",
      }),
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
    createBookingForHiker.mockRejectedValue(
      new BookingError(409, "Slot is not available"),
    );
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
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to create booking",
    });
  });
});

describe("createStaffBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 400 if the request body is missing", async () => {
    const res = mockRes();
    await createStaffBooking(mockReq(null), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid request body" });
  });

  it("returns 400 if the request body is an array", async () => {
    const res = mockRes();
    await createStaffBooking(mockReq([1, 2]), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid request body" });
  });

  it("returns 400 if hiker is missing", async () => {
    const res = mockRes();
    await createStaffBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, hiker: null }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Hiker information is required",
    });
  });

  it("returns 400 if hiker mode is not valid", async () => {
    const res = mockRes();
    await createStaffBooking(
      mockReq({ slotId: 1, numberOfPeople: 2, hiker: { mode: "invalid" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Hiker mode must be EXISTING, FULL or QUICK",
    });
  });

  it.each([
    {
      hiker: {
        mode: "QUICK",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "3607765289",
      },
      slotId: 0,
      numberOfPeople: 2,
    },
    {
      hiker: {
        mode: "QUICK",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "3607765289",
      },
      slotId: "1",
      numberOfPeople: 2,
    },
    {
      hiker: {
        mode: "QUICK",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "3607765289",
      },
      slotId: 1,
      numberOfPeople: 0,
    },
    {
      hiker: {
        mode: "QUICK",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "3607765289",
      },
      slotId: 1,
      numberOfPeople: 0,
      allergyFlag: "invalid",
    },
    {
      hiker: {
        mode: "QUICK",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "3607765289",
      },
      slotId: 1,
      numberOfPeople: 0,
      allergyFlag: true,
      allergyDescription: [1, 2, 3],
    },
  ])(
    "validates the request body and returns 400 for invalid input %#",
    async (body) => {
      const res = mockRes();
      await createStaffBooking(mockReq(body), res);
      expect(res.status).toHaveBeenCalledWith(400);
    },
  );

  it("returns 400 if allergy description is not provided", async () => {
    const res = mockRes();
    await createStaffBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        allergyFlag: true,
        hiker: {
          mode: "QUICK",
          firstName: "Mario",
          lastName: "Rossi",
          phone: "3607765289",
        },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Allergy description is required",
    });
  });

  it("returns 400 if allergy description is blank", async () => {
    const res = mockRes();
    await createStaffBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        allergyFlag: true,
        hiker: {
          mode: "QUICK",
          firstName: "Mario",
          lastName: "Rossi",
          phone: "3607765289",
        },
        allergyDescription: "   ",
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Allergy description is required",
    });
  });

  it("returns 400 if dietaryRequirements is not an array", async () => {
    const res = mockRes();
    await createStaffBooking(
      mockReq({
        slotId: 1,
        numberOfPeople: 2,
        hiker: {
          mode: "QUICK",
          firstName: "Mario",
          lastName: "Rossi",
          phone: "3607765289",
        },
        dietaryRequirements: "vegetarian",
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "dietaryRequirements must be an array",
    });
  });

  it.each([
    {
      mode: "EXISTING",
      hiker: { mode: "EXISTING", id: 1 },
      resultHiker: {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@mail.com",
        phone: "1234567890",
        isTemporary: false,
      },
      generatedPassword: null,
    },
    {
      mode: "FULL",
      hiker: {
        mode: "FULL",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@mail.com",
        phone: "1234567890",
      },
      resultHiker: {
        id: 2,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@mail.com",
        phone: "1234567890",
        isTemporary: false,
      },
      generatedPassword: "generated-password",
    },
    {
      mode: "QUICK",
      hiker: {
        mode: "QUICK",
        firstName: "John",
        lastName: "Doe",
        phone: "1234567890",
      },
      resultHiker: {
        id: 3,
        firstName: "John",
        lastName: "Doe",
        email: null,
        phone: "1234567890",
        isTemporary: true,
      },
      generatedPassword: null,
    },
  ])("creates a booking for a $mode hiker", async ({
    hiker,
    resultHiker,
    generatedPassword,
  }) => {
    const booking = {
      id: 99,
      hikerId: resultHiker.id,
      slotId: 10,
      numberOfPeople: 2,
      status: "CONFIRMED",
    };
    createBookingByStaff.mockResolvedValue({
      booking,
      hiker: resultHiker,
      generatedPassword,
    });
    const req = mockReq({
      hiker,
      slotId: 10,
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: "  peanuts  ",
      dietaryRequirements: [{ allergies: false, description: "vegetarian" }],
    });
    const res = mockRes();

    await createStaffBooking(req, res);

    expect(createBookingByStaff).toHaveBeenCalledWith({
      hiker,
      slotId: 10,
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: "peanuts",
      dietaryRequirements: [{ allergies: false, description: "vegetarian" }],
    });
    expect(notifyBookingConfirmed).toHaveBeenCalledWith(booking.id);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ...booking,
      hiker: resultHiker,
      ...(generatedPassword ? { generatedPassword } : {}),
    });
  });

  it("returns 201 when sending the confirmation email fails", async () => {
    const booking = {
      id: 99,
      hikerId: 1,
      slotId: 10,
      numberOfPeople: 1,
      status: "CONFIRMED",
    };
    const result = {
      booking,
      hiker: {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@mail.com",
        phone: "1234567890",
        isTemporary: false,
      },
      generatedPassword: null,
    };
    const notificationError = new Error("SMTP unavailable");
    createBookingByStaff.mockResolvedValue(result);
    notifyBookingConfirmed.mockRejectedValue(notificationError);
    const res = mockRes();

    await createStaffBooking(
      mockReq({
        hiker: { mode: "EXISTING", id: 1 },
        slotId: 10,
        numberOfPeople: 1,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      ...booking,
      hiker: result.hiker,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Booking notification failed:",
      notificationError,
    );
  });
});
