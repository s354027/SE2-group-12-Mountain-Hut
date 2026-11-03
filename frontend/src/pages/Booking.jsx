import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

function formatTime(time) {
  return time ? time.slice(0, 5) : "Not available";
}

function getSlotEndTime(startTime, endTime, duration) {
  if (endTime) return formatTime(endTime);
  if (!startTime) return "Not available";

  const [hours, minutes] = startTime.split(":").map(Number);
  const end = new Date(2000, 0, 1, hours, minutes);
  end.setMinutes(
    end.getMinutes() +
      (Number.isFinite(Number(duration)) ? Number(duration) : 60),
  );
  return end.toTimeString().slice(0, 5);
}

export default function Booking() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const availability = state?.availability ?? null;
  const date = availability?.date ?? state?.date;
  const requestedTime = state?.time;
  const numberOfPeople = availability?.partySize ?? state?.numberOfPeople;
  const [allergyFlag, setAllergyFlag] = useState(false);
  const [allergyDescription, setAllergyDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmedAllergyDescription, setConfirmedAllergyDescription] =
    useState(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);

  async function confirmBooking() {
    setError(null);
    setConfirmation(null);
    setShowConfirmationDialog(false);
    setSubmitting(true);

    try {
      const booking = await api.post("/bookings", {
        slotId: availability.slotId,
        numberOfPeople: Number(numberOfPeople),
        allergyFlag,
        allergyDescription: allergyFlag ? allergyDescription : null,
      });
      setConfirmation(
        "Your table has been reserved successfully. You will receive a confirmation email.",
      );
      setConfirmedAllergyDescription(
        allergyFlag ? allergyDescription.trim() : null,
      );
      setAllergyFlag(false);
      setAllergyDescription("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setShowConfirmationDialog(true);
  }

  return (
    <section className="booking-card">
      <div className="booking-progress" aria-label="Booking progress">
        <span className="progress-step complete">1. Availability</span>
        <span className="progress-line" />
        <span
          className={`progress-step ${confirmation ? "complete" : "current"}`}
        >
          2. Review booking
        </span>
        <span className="progress-line" />
        <span className={`progress-step ${confirmation ? "current" : ""}`}>
          3. Confirmed
        </span>
      </div>
      <h1>{confirmation ? "Booking confirmed" : "Book a table"}</h1>
      <p className="booking-intro">
        {confirmation
          ? confirmation
          : "Review your selected availability and add any allergy information before confirming."}
      </p>

      {!availability?.available && (
        <div className="form-error" role="alert">
          Check availability before starting a booking.
        </div>
      )}

      {availability?.available && (
        <div className="availability-result" role="status">
          <h2>Your selection</h2>
          <dl className="booking-summary">
            <div>
              <dt>Date</dt>
              <dd>{date}</dd>
            </div>
            <div>
              <dt>Requested time</dt>
              <dd>{formatTime(requestedTime)}</dd>
            </div>
            <div>
              <dt>Party size</dt>
              <dd>
                {numberOfPeople}{" "}
                {Number(numberOfPeople) === 1 ? "person" : "people"}
              </dd>
            </div>
            <div>
              <dt>Hourly slot</dt>
              <dd>
                {formatTime(availability.startTime)}-
                {getSlotEndTime(
                  availability.startTime,
                  availability.endTime ?? availability.slotEndTime,
                  availability.duration,
                )}
              </dd>
            </div>
            <div>
              <dt>Table allocation</dt>
              <dd>
                {availability.tables.map((table) => (
                  <span key={table.id} className="table-allocation">
                    <strong>Table {table.tableNumber}</strong>
                    <span>
                      · {table.allocatedSeats}{" "}
                      {table.allocatedSeats === 1 ? "seat" : "seats"}
                    </span>
                  </span>
                ))}
              </dd>
            </div>
            {confirmation && confirmedAllergyDescription && (
              <div>
                <dt>Allergy notes</dt>
                <dd>{confirmedAllergyDescription}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {!confirmation && (
        <form onSubmit={handleSubmit}>
          <fieldset className="allergy-field">
            <legend>Allergy information</legend>
            <label className="checkbox-label" htmlFor="booking-allergies">
              <input
                id="booking-allergies"
                name="allergyFlag"
                type="checkbox"
                checked={allergyFlag}
                onChange={(event) => setAllergyFlag(event.target.checked)}
              />
              I have allergies or dietary requirements
            </label>
            {allergyFlag && (
              <div className="field">
                <label htmlFor="booking-allergy-description">
                  Allergy notes
                </label>
                <textarea
                  id="booking-allergy-description"
                  name="allergyDescription"
                  value={allergyDescription}
                  onChange={(event) =>
                    setAllergyDescription(event.target.value)
                  }
                  rows="3"
                  required
                  placeholder="Please describe the allergy or dietary requirement"
                />
              </div>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="booking-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/search")}
            >
              Change availability
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !availability?.available}
            >
              {submitting ? "Booking..." : "Confirm booking"}
            </button>
          </div>
        </form>
      )}

      {showConfirmationDialog && (
        <>
          <div className="modal-backdrop fade show" />
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-confirmation-title"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2
                    className="modal-title fs-5"
                    id="booking-confirmation-title"
                  >
                    Confirm your booking
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setShowConfirmationDialog(false)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    This will reserve the selected table allocation. Continue?
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowConfirmationDialog(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmBooking}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
