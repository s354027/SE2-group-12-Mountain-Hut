import { useState } from "react";
import { api } from "../api/client.js";
import HikerIdentityFields from "../components/HikerIdentityFields.jsx";
import RequirementsList from "../components/RequirementsList.jsx";
import RequirementsModal from "../components/RequirementsModal.jsx";
import "./StaffBooking.css";

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function StaffBooking() {
  const [date, setDate] = useState(localDate);
  const [time, setTime] = useState("12:00");
  const [partySize, setPartySize] = useState("2");
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [hiker, setHiker] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  function invalidateAvailability() {
    setAvailability(null);
    setError("");
    setConfirmation(null);
  }

  async function checkAvailability(event) {
    event.preventDefault();
    setChecking(true);
    setError("");
    setAvailability(null);
    setConfirmation(null);
    try {
      const params = new URLSearchParams({
        date,
        startTime: time,
        partySize: String(partySize),
      });
      setAvailability(await api.get(`/availability?${params}`));
    } catch (err) {
      setError(err.message || "Could not check availability.");
    } finally {
      setChecking(false);
    }
  }

  function saveRequirement(requirement) {
    setRequirements((current) =>
      editingIndex === null
        ? [...current, requirement]
        : current.map((item, index) => index === editingIndex ? requirement : item)
    );
    setEditingIndex(null);
    setShowModal(false);
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!availability?.available || !availability.slotId) {
      setError("Please check availability and select an available slot first.");
      return;
    }
    if (!hiker) {
      setError("Please complete the hiker information first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Matches the agreed hiker identity contract from MH-81.
      const result = await api.post("/bookings/staff", {
        slotId: availability.slotId,
        numberOfPeople: Number(partySize),
        dietaryRequirements: requirements,
        hiker,
      });
      setConfirmation(result);
    } catch (err) {
      if (err.status === 409) {
        setError("This slot is no longer available or conflicts with an existing booking. Check availability again.");
        setAvailability(null);
      } else {
        setError(err.message || "Unable to create the booking.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setConfirmation(null);
    setAvailability(null);
    setHiker(null);
    setRequirements([]);
    setError("");
  }

  return (
    <section className="staff-booking-page">
      <header className="staff-booking-header">
        <span className="field-guide-kicker">STAFF / RESERVATIONS</span>
        <h1>Reserve for a hiker</h1>
        <p>Create a reservation on behalf of a guest. Available to employees and wardens.</p>
      </header>

      {confirmation ? (
        <section className="staff-booking-panel" role="status">
          <h2>Booking confirmed</h2>
          <p>The reservation has been created successfully.</p>
          {confirmation.id != null && <p>Booking reference: <strong>{confirmation.id}</strong></p>}
          {confirmation.booking?.id != null && <p>Booking reference: <strong>{confirmation.booking.id}</strong></p>}
          {confirmation.temporaryPassword && (
            <div className="staff-booking-secret">
              <strong>Temporary password for the hiker</strong>
              <p>Share this privately with the hiker. It may only be displayed once.</p>
              <code>{confirmation.temporaryPassword}</code>
            </div>
          )}
          {confirmation.password && (
            <div className="staff-booking-secret">
              <strong>Generated password</strong>
              <p>Share privately with the hiker.</p>
              <code>{confirmation.password}</code>
            </div>
          )}
          <button type="button" className="btn-primary" onClick={startAnother}>Create another booking</button>
        </section>
      ) : (
        <>
          <section className="staff-booking-panel">
            <h2>1. Find an available table</h2>
            <form onSubmit={checkAvailability} className="staff-booking-fields">
              <label>Date
                <input type="date" required min={localDate()} value={date}
                  onChange={(event) => { setDate(event.target.value); invalidateAvailability(); }} />
              </label>
              <label>Arrival time
                <input type="time" required value={time}
                  onChange={(event) => { setTime(event.target.value); invalidateAvailability(); }} />
              </label>
              <label>Number of people
                <select value={partySize}
                  onChange={(event) => { setPartySize(event.target.value); invalidateAvailability(); }}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((n) =>
                    <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>)}
                </select>
              </label>
              <button className="btn-primary" type="submit" disabled={checking}>
                {checking ? "Checking..." : "Check availability"}
              </button>
            </form>
            {availability && (
              <div className={availability.available ? "staff-booking-available" : "form-error"} role="status">
                {availability.available ? (
                  <>
                    <strong>Available — {String(availability.startTime || time).slice(0, 5)}</strong>
                    <p>{partySize} {Number(partySize) === 1 ? "guest" : "guests"} · {date}</p>
                    {Array.isArray(availability.tables) && availability.tables.length > 0 && (
                      <p>Tables: {availability.tables.map((table) =>
                        `#${table.tableNumber} (${table.allocatedSeats} seats)`).join(", ")}</p>
                    )}
                  </>
                ) : <p>No suitable table is available. Try another time or date.</p>}
              </div>
            )}
          </section>

          {availability?.available && (
            <form onSubmit={submitBooking}>
              <section className="staff-booking-panel">
                <h2>2. Hiker information</h2>
                <HikerIdentityFields value={hiker} onChange={setHiker} />
              </section>
              <section className="staff-booking-panel">
                <h2>3. Dietary requirements</h2>
                <p>Optional: add dietary needs and mark any allergies.</p>
                <RequirementsList partyRequirements={requirements}
                  onEdit={(index) => { setEditingIndex(index); setShowModal(true); }}
                  onRemove={(index) => setRequirements((current) => current.filter((_, i) => i !== index))} />
                <button type="button" className="btn-secondary" onClick={() => { setEditingIndex(null); setShowModal(true); }}>
                  Add requirement
                </button>
              </section>
              {error && <p role="alert" className="form-error">{error}</p>}
              <div className="staff-booking-actions">
                <button type="submit" className="btn-primary" disabled={!hiker || submitting}>
                  {submitting ? "Creating booking..." : "Confirm staff booking"}
                </button>
              </div>
            </form>
          )}
          {error && !availability?.available && <p role="alert" className="form-error">{error}</p>}
          <RequirementsModal
            initialRequirement={editingIndex === null ? null : requirements[editingIndex]}
            onClose={() => { setShowModal(false); setEditingIndex(null); }}
            onSave={saveRequirement}
            showRequirementsModal={showModal}
          />
        </>
      )}
    </section>
  );
}
