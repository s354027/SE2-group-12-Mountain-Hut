import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingsList from "../src/components/BookingsList.jsx";
import { api } from "../src/api/client.js";

vi.mock("../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const booking = {
  id: 12,
  slotId: 10,
  numberOfPeople: 2,
  status: "CONFIRMED",
  allergyFlag: true,
  allergyDescription: "Peanuts",
  dietaryRequirements: [
    { description: "Vegetarian", allergies: false },
  ],
  tables: [],
  slot: {
    id: 10,
    date: "2099-11-23",
    startTime: "12:00:00",
    meal: "LUNCH",
  },
};

describe("BookingsList booking edit modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens as a two-step modal and makes no requests for an unchanged booking", async () => {
    render(<BookingsList bookings={[booking]} onBookingUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Modify booking" }));

    expect(screen.getByLabelText("Date")).toHaveValue("2099-11-23");
    expect(screen.getByLabelText("Start time")).toHaveValue("12:00");
    expect(screen.getByLabelText("Number of guests")).toHaveValue(2);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByRole("button", {
        name: "Remove requirement: Vegetarian",
      }),
    ).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Modify booking" }),
      ).not.toBeInTheDocument();
    });
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("normalizes serialized date and time values before checking for changes", async () => {
    const serializedBooking = {
      ...booking,
      slot: {
        ...booking.slot,
        date: "2099-11-23T00:00:00.000Z",
        startTime: "12:00:00.000Z",
      },
    };
    render(
      <BookingsList bookings={[serializedBooking]} onBookingUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Modify booking" }));

    expect(screen.getByLabelText("Date")).toHaveValue("2099-11-23");
    expect(screen.getByLabelText("Start time")).toHaveValue("12:00");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByRole("button", {
        name: "Remove requirement: Vegetarian",
      }),
    ).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("does not mark an entered time as updated when it resolves to the same slot", async () => {
    api.get.mockResolvedValue({
      available: true,
      slotId: booking.slotId,
      date: booking.slot.date,
      startTime: booking.slot.startTime,
      partySize: booking.numberOfPeople,
      breakdown: "2 seats",
    });
    render(<BookingsList bookings={[booking]} onBookingUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Modify booking" }));
    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const saveButton = await screen.findByRole("button", {
      name: "Save changes",
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveTextContent("Updated");
    expect(dialog).not.toHaveTextContent("2 seats");
    expect(saveButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("checks changed availability and saves the returned slot in one patch", async () => {
    const onBookingUpdated = vi.fn();
    api.get.mockResolvedValue({
      available: true,
      slotId: 11,
      date: "2099-11-24",
      startTime: "12:00:00",
      meal: "LUNCH",
      partySize: 3,
      breakdown: "2 + 1 seats",
    });
    api.patch.mockResolvedValue({
      ...booking,
      slotId: 11,
      numberOfPeople: 3,
      dietaryRequirements: [
        { description: "Vegan", allergies: true },
      ],
      slot: {
        id: 11,
        date: "2099-11-24",
        startTime: "12:00:00",
        meal: "LUNCH",
      },
    });

    render(
      <BookingsList
        bookings={[booking]}
        onBookingUpdated={onBookingUpdated}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Modify booking" }));
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2099-11-24" },
    });
    fireEvent.change(screen.getByLabelText("Number of guests"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText(/2 \+ 1 seats/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      "/availability?date=2099-11-24&startTime=12%3A00&partySize=3&skipBookingId=12",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove requirement: Vegetarian",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add requirement" }));
    fireEvent.change(
      screen.getByLabelText("Requirement description"),
      { target: { value: "Vegan" } },
    );
    fireEvent.click(screen.getByLabelText("This is an allergy"));
    fireEvent.click(screen.getByRole("button", { name: "Add requirement" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith("/bookings/12", {
      slotId: 11,
      numberOfPeople: 3,
      dietaryRequirements: [{ description: "Vegan", allergies: true }],
    });
    expect(onBookingUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: 11,
        numberOfPeople: 3,
        slot: expect.objectContaining({ id: 11 }),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("cancels an active booking after confirmation", async () => {
    const onBookingUpdated = vi.fn();
    const cancelledBooking = { ...booking, status: "CANCELLED" };
    api.patch.mockResolvedValue(cancelledBooking);

    const { rerender } = render(
      <BookingsList
        bookings={[booking]}
        hikerId={7}
        onBookingUpdated={onBookingUpdated}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel booking?" });
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm cancellation" }),
    );

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/hikers/7/bookings/12/cancel"),
    );
    expect(onBookingUpdated).toHaveBeenCalledWith(cancelledBooking);
    rerender(
      <BookingsList
        bookings={[cancelledBooking]}
        hikerId={7}
        onBookingUpdated={onBookingUpdated}
      />,
    );
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Modify booking" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });

  it("shows cancellation errors and lets the user retry", async () => {
    api.patch.mockRejectedValueOnce(new Error("Booking is not active"));

    render(
      <BookingsList
        bookings={[booking]}
        hikerId={7}
        onBookingUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel booking?" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm cancellation" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Booking is not active",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cancel booking" }),
      ).toBeEnabled(),
    );
  });
});
