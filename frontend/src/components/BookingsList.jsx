import { useState } from "react";
import { api } from "../api/client.js";

const EDIT_DEADLINE_MS = 48 * 60 * 60 * 1000;

function slotStartsWithinEditWindow(slot) {
  if (!slot?.date || !slot?.startTime) return true;
  const start = new Date(`${slot.date}T${slot.startTime}`);
  return (
    Number.isNaN(start.getTime()) ||
    start.getTime() - Date.now() < EDIT_DEADLINE_MS
  );
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  return value ? value.slice(0, 5) : "Time unavailable";
}

function BookingCard({ booking, onBookingUpdated }) {
  const [editing, setEditing] = useState(false);
  const [numberOfPeople, setNumberOfPeople] = useState(
    String(booking.numberOfPeople),
  );
  const [allergyFlag, setAllergyFlag] = useState(booking.allergyFlag);
  const [allergyDescription, setAllergyDescription] = useState(
    booking.allergyDescription ?? "",
  );
  const [dietaryText, setDietaryText] = useState(
    (booking.dietaryRequirements ?? [])
      .map((requirement) => requirement.description)
      .join("\n"),
  );
  const [dietaryChanged, setDietaryChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canEdit = !slotStartsWithinEditWindow(booking.slot);

  async function saveChanges(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updatedBooking = await api.patch(`/bookings/${booking.id}`, {
        numberOfPeople: Number(numberOfPeople),
        allergyFlag,
        allergyDescription: allergyFlag ? allergyDescription : null,
        ...(dietaryChanged
          ? {
              dietaryRequirements: dietaryText
                .split("\n")
                .map((description) => description.trim())
                .filter(Boolean)
                .map((description) => ({ description, allergies: false })),
            }
          : {}),
      });
      const savedBooking = {
        ...booking,
        ...updatedBooking,
        slot: updatedBooking.slot ?? booking.slot,
      };
      setNumberOfPeople(String(savedBooking.numberOfPeople));
      setAllergyFlag(savedBooking.allergyFlag);
      setAllergyDescription(savedBooking.allergyDescription ?? "");
      setDietaryText(
        (savedBooking.dietaryRequirements ?? [])
            .map((requirement) => requirement.description)
            .join("\n"),
      );
      setDietaryChanged(false);
      onBookingUpdated(savedBooking);
      setEditing(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="hiker-booking-card">
      <div className="hiker-booking-card-heading">
        <div>
          <h2>{booking.slot?.meal || "Mountain hut booking"}</h2>
          <p>
            {formatDate(booking.slot?.date)} at{" "}
            {formatTime(booking.slot?.startTime)}
          </p>
        </div>
        <span className="hiker-booking-status">{booking.status}</span>
      </div>

      <dl className="hiker-booking-details">
        <div>
          <dt>Guests</dt>
          <dd>{booking.numberOfPeople}</dd>
        </div>
        {booking.tables?.length > 0 && (
          <div>
            <dt>Tables</dt>
            <dd>
              {booking.tables
                .map(
                  (table) =>
                    `Table ${table.tableNumber} (${table.allocatedSeats ?? table.seats} seats)`,
                )
                .join(", ")}
            </dd>
          </div>
        )}
        {booking.allergyFlag && (
          <div>
            <dt>Allergy</dt>
            <dd>{booking.allergyDescription}</dd>
          </div>
        )}
        {booking.dietaryRequirements?.length > 0 && (
          <div>
            <dt>Dietary requirements</dt>
            <dd>
              {booking.dietaryRequirements
                .map((requirement) => requirement.description)
                .join(", ")}
            </dd>
          </div>
        )}
      </dl>

      {canEdit && !editing && (
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => setEditing(true)}
        >
          Modify booking
        </button>
      )}

      {editing && (
        <form className="hiker-booking-edit" onSubmit={saveChanges}>
          <label>
            Number of guests
            <input
              className="form-control"
              type="number"
              min="1"
              max={booking.slot?.totalCapacity}
              value={numberOfPeople}
              onChange={(event) => setNumberOfPeople(event.target.value)}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allergyFlag}
              onChange={(event) => setAllergyFlag(event.target.checked)}
            />
            Allergy to report
          </label>
          {allergyFlag && (
            <label>
              Allergy description
              <input
                className="form-control"
                value={allergyDescription}
                onChange={(event) => setAllergyDescription(event.target.value)}
                required
              />
            </label>
          )}
          <label>
            Dietary requirements (one per line)
            <textarea
              className="form-control"
              rows="3"
              value={dietaryText}
              onChange={(event) => {
                setDietaryChanged(true);
                setDietaryText(event.target.value);
              }}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="booking-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setError("");
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

export default function BookingsList({ bookings, onBookingUpdated }) {
  if (bookings.length === 0) {
    return <p>You have no upcoming bookings.</p>;
  }

  return (
    <div className="hiker-bookings-list">
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onBookingUpdated={onBookingUpdated}
        />
      ))}
    </div>
  );
}