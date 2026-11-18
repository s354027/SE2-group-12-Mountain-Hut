import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";

import BookingsList from "../../components/BookingsList";

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function getBookings() {
      setLoading(true);
      setError("");

      try {
        const result = await api.get(
          `/hikers/${user.id}/bookings?upcoming=true`,
        );
        if (active) setBookings(result);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (user?.id) getBookings();
    return () => {
      active = false;
    };
  }, [user?.id]);

  function updateBooking(updatedBooking) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === updatedBooking.id ? updatedBooking : booking,
      ),
    );
  }

  return (
    <section className="hiker-bookings">
      <h1>Your Bookings</h1>
      <p className="hiker-bookings-intro">
        Manage your upcoming stays at the mountain hut
      </p>
      {loading ? (
        <div
          className="hiker-bookings-loading d-flex justify-content-start"
          role="status"
          aria-label="Loading your bookings"
        >
          <span className="spinner-border" aria-hidden="true" />
          <span className="visually-hidden">Loading your bookings...</span>
        </div>
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : (
        <BookingsList bookings={bookings} onBookingUpdated={updateBooking} />
      )}
    </section>
  );
}
