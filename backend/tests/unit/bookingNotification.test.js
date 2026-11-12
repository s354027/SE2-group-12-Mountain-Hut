import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyBookingConfirmed } from "../../src/services/bookingNotifications.js";

const { findByPk, sendBookingConfirmation } = vi.hoisted(() => ({
  findByPk: vi.fn(),
  sendBookingConfirmation: vi.fn(),
}));

vi.mock("../../src/db/index.js", () => ({
  models: {
    Booking: { findByPk },
  },
}));

vi.mock("../../src/services/emailService.js", () => ({
  sendBookingConfirmation,
}));

describe("sendBookingNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendBookingConfirmation.mockResolvedValue(true);
  });

  it("throws when the booking is not found", async () => {
    const bookingId = 1;
    findByPk.mockResolvedValueOnce(null);
    await expect(notifyBookingConfirmed(bookingId)).rejects.toThrow(
      `Booking ${bookingId} not found`,
    );
  });

  it("throws an error when the hiker has no email on file", async () => {
    const bookingId = 1;
    findByPk.mockResolvedValueOnce({
      id: bookingId,
      hiker: { email: null },
    });
    await expect(notifyBookingConfirmed(bookingId)).resolves.toBe(false);
  });

  it("calls sendBookingConfirmation with the correct parameters", async () => {
    const bookingId = 1;
    findByPk.mockResolvedValueOnce({
      id: bookingId,
      hiker: { email: "test@test.local", firstName: "John", lastName: "Doe" },
      slot: { date: "2024-06-01", startTime: "10:00:00", duration: 60 },
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: "Peanuts",
    });

    await expect(notifyBookingConfirmed(bookingId)).resolves.toBe(true);
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      "test@test.local",
      "John Doe",
      bookingId,
      "01/06/2024",
      "10:00",
      "11:00",
      2,
      "Peanuts (allergy)",
    );
  });

  it("calls sendBookingConfirmation with null allergyDescription when allergyFlag is false", async () => {
    const bookingId = 1;
    findByPk.mockResolvedValueOnce({
      id: bookingId,
      hiker: { email: "test@test.local", firstName: "John", lastName: "Doe" },
      slot: { date: "2024-06-01", startTime: "10:00:00", duration: 60 },
      numberOfPeople: 2,
      allergyFlag: false,
      allergyDescription: null,
    });

    await expect(notifyBookingConfirmed(bookingId)).resolves.toBe(true);
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      "test@test.local",
      "John Doe",
      bookingId,
      "01/06/2024",
      "10:00",
      "11:00",
      2,
      null,
    );
  });

  it("includes the dietary requirements list in the email when present", async () => {
    const bookingId = 1;
    findByPk.mockResolvedValueOnce({
      id: bookingId,
      hiker: { email: "test@test.local", firstName: "John", lastName: "Doe" },
      slot: { date: "2024-06-01", startTime: "10:00:00", duration: 60 },
      numberOfPeople: 2,
      allergyFlag: false,
      allergyDescription: null,
      dietaryRequirements: [
        { allergies: true, description: "1 vegan, peanut allergy" },
        { allergies: false, description: "1 vegetarian" },
      ],
    });

    await expect(notifyBookingConfirmed(bookingId)).resolves.toBe(true);
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      "test@test.local",
      "John Doe",
      bookingId,
      "01/06/2024",
      "10:00",
      "11:00",
      2,
      "1 vegan, peanut allergy (allergy), 1 vegetarian",
    );
  });

  it("combines the legacy allergy description with the dietary requirements list", async () => {
    const bookingId = 1;
    findByPk.mockResolvedValueOnce({
      id: bookingId,
      hiker: { email: "test@test.local", firstName: "John", lastName: "Doe" },
      slot: { date: "2024-06-01", startTime: "10:00:00", duration: 60 },
      numberOfPeople: 2,
      allergyFlag: true,
      allergyDescription: "Peanuts",
      dietaryRequirements: [{ allergies: false, description: "2 vegetarians" }],
    });

    await expect(notifyBookingConfirmed(bookingId)).resolves.toBe(true);
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      "test@test.local",
      "John Doe",
      bookingId,
      "01/06/2024",
      "10:00",
      "11:00",
      2,
      "Peanuts (allergy), 2 vegetarians",
    );
  });
});
