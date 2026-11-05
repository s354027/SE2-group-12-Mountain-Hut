import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail, verify, on } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  verify: vi.fn(),
  on: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail, verify, on })),
  },
}));

import {
  sendBookingConfirmation,
  verifyTransporter,
} from "../../src/services/emailService.js";

// Captured right after import, before beforeEach() clears the mocks below.
const errorHandler = on.mock.calls.find(([event]) => event === "error")?.[1];

describe("emailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a booking confirmation email with the booking details", async () => {
    sendMail.mockResolvedValue({ messageId: "message-123" });

    await expect(
      sendBookingConfirmation(
        "hiker@example.com",
        "John Doe",
        42,
        "01/06/2024",
        "10:00",
        "11:00",
        2,
        "Window seat",
      ),
    ).resolves.toBe(true);

    expect(sendMail).toHaveBeenCalledWith({
      from: "<noreply@mountainhut.it>",
      to: "hiker@example.com",
      subject: "Booking Confirmation #42",
      html: expect.stringContaining("Window seat"),
    });
    expect(sendMail.mock.calls[0][0].html).toContain("John Doe");
    expect(sendMail.mock.calls[0][0].html).toContain("01/06/2024");
    expect(sendMail.mock.calls[0][0].html).toContain("10:00 – 11:00");
    expect(sendMail.mock.calls[0][0].html).toContain("2 people");
  });

  it("uses the default text when party requirements are omitted", async () => {
    sendMail.mockResolvedValue({ messageId: "message-123" });

    await sendBookingConfirmation(
      "hiker@example.com",
      "John Doe",
      42,
      "01/06/2024",
      "10:00",
      "11:00",
      2,
    );

    expect(sendMail.mock.calls[0][0].html).toContain("None specified");
  });

  it("returns false when sending the email fails", async () => {
    sendMail.mockRejectedValue(new Error("SMTP unavailable"));

    await expect(
      sendBookingConfirmation(
        "hiker@example.com",
        "John Doe",
        42,
        "01/06/2024",
        "10:00",
        "11:00",
        2,
      ),
    ).resolves.toBe(false);
  });

  it.each([
    ["recipient", ["", "John Doe", 42, "01/06/2024", "10:00", "11:00", 2]],
    ["username", ["hiker@example.com", "", 42, "01/06/2024", "10:00", "11:00", 2]],
    ["reservation ID", ["hiker@example.com", "John Doe", 1.5, "01/06/2024", "10:00", "11:00", 2]],
    ["party size", ["hiker@example.com", "John Doe", 42, "01/06/2024", "10:00", "11:00", 0]],
    ["party requirements", ["hiker@example.com", "John Doe", 42, "01/06/2024", "10:00", "11:00", 2, -1]],
  ])("rejects an invalid %s", async (_field, args) => {
    await expect(sendBookingConfirmation(...args)).rejects.toThrow(TypeError);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("verifies the transporter successfully", async () => {
    verify.mockResolvedValue(true);

    await expect(verifyTransporter()).resolves.toBeUndefined();

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("logs transporter verification errors without throwing", async () => {
    verify.mockRejectedValue(new Error("SMTP unavailable"));

    await expect(verifyTransporter()).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("logs pool connection errors from the transporter instead of crashing", () => {
    expect(errorHandler).toBeInstanceOf(Function);

    const poolError = new Error("connect ECONNREFUSED 127.0.0.1:1025");
    errorHandler(poolError);

    expect(console.error).toHaveBeenCalledWith("Email transporter error:", poolError);
  });
});