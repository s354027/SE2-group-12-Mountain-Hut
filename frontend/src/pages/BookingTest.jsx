import { useNavigate } from "react-router-dom";

const testAvailability = {
  available: true,
  slotId: 1,
  date: "2026-11-10",
  startTime: "19:00:00",
  endTime: "20:00:00",
  partySize: 3,
  tables: [
    { id: 1, tableNumber: 2, allocatedSeats: 2 },
    { id: 2, tableNumber: 4, allocatedSeats: 1 },
  ],
};

export default function BookingTest() {
  const navigate = useNavigate();

  function startTestBooking() {
    navigate("/booking-test/form", {
      state: {
        time: "19:15",
        numberOfPeople: 3,
        availability: testAvailability,
      },
    });
  }

  return (
    <section className="booking-card test-card">
      <span className="eyebrow">Development tool</span>
      <h1>Booking form test</h1>
      <p className="booking-intro">
        Open the booking form with sample availability data to test its layout
        and confirmation flow.
      </p>
      <button type="button" className="btn-primary" onClick={startTestBooking}>
        Start test booking
      </button>
    </section>
  );
}
