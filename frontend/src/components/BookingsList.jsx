import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import RequirementsList from "./RequirementsList.jsx";

const EDIT_DEADLINE_MS = 48 * 60 * 60 * 1000;

function slotStartsWithinEditWindow(slot) {
  if (!slot?.date || !slot?.startTime) return true;
  const date = normalizeDate(slot.date);
  const startTime = normalizeTime(slot.startTime);
  if (!date || !startTime) return true;

  const start = new Date(`${date}T${startTime}`);
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
  }).format(new Date(`${normalizeDate(value)}T12:00:00`));
}

function formatTime(value) {
  return value ? value.slice(0, 5) : "Time unavailable";
}

function normalizeDate(value) {
  return String(value ?? "").slice(0, 10);
}

function normalizeTime(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  return match
    ? `${match[1].padStart(2, "0")}:${match[2]}`
    : "";
}

function formatErrorMessage(message) {
  return String(message ?? "Unable to update the booking")
    .replace(/\bHiker already has a booking\b/gi, "You already have a booking")
    .replace(/\bCannot modify another hiker booking\b/gi, "You cannot modify this booking")
    .replace(/\bHiker\b/g, "You")
    .replace(/\bhiker\b/g, "you");
}

function getDietaryText(requirements = []) {
  return requirements.map((requirement) => requirement.description).join("\n");
}

function BookingEditModal({ booking, onClose, onBookingUpdated }) {
  const originalDate = normalizeDate(booking.slot?.date);
  const originalStartTime = normalizeTime(booking.slot?.startTime);
  const originalPartySize = Number(booking.numberOfPeople);
  const originalDietaryRequirements = booking.dietaryRequirements ?? [];
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(originalDate);
  const [startTime, setStartTime] = useState(originalStartTime);
  const [numberOfPeople, setNumberOfPeople] = useState(
    String(originalPartySize),
  );
  const [dietaryRequirements, setDietaryRequirements] = useState(() =>
    originalDietaryRequirements.map((requirement) => ({ ...requirement })),
  );
  const [addingRequirement, setAddingRequirement] = useState(false);
  const [newRequirementDescription, setNewRequirementDescription] =
    useState("");
  const [newRequirementIsAllergy, setNewRequirementIsAllergy] =
    useState(false);
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const partySize = Number(numberOfPeople);
  const scheduleChanged =
    normalizeDate(date) !== originalDate ||
    normalizeTime(startTime) !== originalStartTime ||
    partySize !== originalPartySize;
  const requirementsChanged =
    dietaryRequirements.length !== originalDietaryRequirements.length ||
    dietaryRequirements.some((requirement, index) => {
      const originalRequirement = originalDietaryRequirements[index];
      return (
        requirement.description.trim() !== originalRequirement.description.trim() ||
        requirement.allergies !== originalRequirement.allergies
      );
    });
  const selectedSlotChanged =
    availability?.slotId != null &&
    Number(availability.slotId) !== Number(booking.slotId);
  const bookingChanged =
    selectedSlotChanged ||
    partySize !== originalPartySize ||
    requirementsChanged;
  function closeRequirementForm() {
    setAddingRequirement(false);
    setNewRequirementDescription("");
    setNewRequirementIsAllergy(false);
  }

  function addRequirement() {
    const description = newRequirementDescription.trim();
    if (!description) return;

    setDietaryRequirements((current) => [
      ...current,
      { description, allergies: newRequirementIsAllergy },
    ]);
    closeRequirementForm();
  }

  function removeRequirement(index) {
    setDietaryRequirements((current) =>
      current.filter((_, requirementIndex) => requirementIndex !== index),
    );
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !checking && !saving) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [checking, onClose, saving]);

  async function goToRequirements(event) {
    event.preventDefault();
    setError("");

    if (!scheduleChanged) {
      setAvailability(null);
      setStep(2);
      return;
    }

    setChecking(true);
    try {
      const result = await api.get(
        `/availability?date=${encodeURIComponent(date)}&startTime=${encodeURIComponent(startTime.slice(0, 5))}&partySize=${encodeURIComponent(numberOfPeople)}&skipBookingId=${encodeURIComponent(booking.id)}`,
      );
      if (!result.available) {
        setError(
          formatErrorMessage(
            result.reason || result.error || "This booking slot is unavailable",
          ),
        );
        return;
      }

      setAvailability(result);
      setStep(2);
    } catch (requestError) {
      setError(formatErrorMessage(requestError.message));
    } finally {
      setChecking(false);
    }
  }

  async function saveChanges(event) {
    event.preventDefault();
    setError("");

    const slotId = availability?.slotId ?? booking.slotId;
    if (!bookingChanged) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updatedBooking = await api.patch(`/bookings/${booking.id}`, {
        slotId,
        numberOfPeople: partySize,
        dietaryRequirements,
      });
      const updatedSlot = updatedBooking.slot ??
        (availability
          ? {
              id: availability.slotId,
              date: availability.date,
              startTime: availability.startTime,
              meal: availability.meal,
            }
          : booking.slot);
      onBookingUpdated({
        ...booking,
        ...updatedBooking,
        slot: updatedSlot,
      });
      onClose();
    } catch (requestError) {
      setError(formatErrorMessage(requestError.message));
    } finally {
      setSaving(false);
    }
  }

  const changedPartySize = partySize !== originalPartySize;
  const summaryChanged = selectedSlotChanged || changedPartySize;
  const changedDate =
    selectedSlotChanged &&
    normalizeDate(availability.date) !== originalDate;
  const changedTime =
    selectedSlotChanged &&
    normalizeTime(availability.startTime) !== originalStartTime;
  const summaryDate = selectedSlotChanged
    ? normalizeDate(availability.date) || originalDate
    : originalDate;
  const summaryTime = selectedSlotChanged
    ? availability.startTime
    : booking.slot?.startTime;
  const summaryPartySize = partySize;

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show d-block booking-edit-modal"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`booking-edit-title-${booking.id}`}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2
                className="modal-title fs-5"
                id={`booking-edit-title-${booking.id}`}
              >
                Modify booking
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="booking-edit-summary" aria-live="polite">
              {step === 1 ? (
                <p className="mb-0">
                  {formatDate(originalDate)} from {originalStartTime} ·{" "}
                  {originalPartySize} guests
                </p>
              ) : (
                <p className="mb-0">
                  {summaryChanged ? (
                    <>
                      {changedDate ? (
                        <strong>{formatDate(summaryDate)}</strong>
                      ) : (
                        formatDate(summaryDate)
                      )}{" "}
                      {changedTime ? (
                        <strong>from {formatTime(summaryTime)}</strong>
                      ) : (
                        `from ${formatTime(summaryTime)}`
                      )}{" "}
                      ·{" "}
                      {changedPartySize ? (
                        <strong>{summaryPartySize} guests</strong>
                      ) : (
                        `${summaryPartySize} guests`
                      )}
                      {availability?.breakdown?.includes("+") && (
                        <> · {availability.breakdown}</>
                      )}
                      <span className="booking-updated-badge">Updated</span>
                    </>
                  ) : (
                    <>
                      {formatDate(originalDate)} from {originalStartTime}{" "}
                      · {originalPartySize} guests
                    </>
                  )}
                </p>
              )}
            </div>

            {step === 1 ? (
              <form onSubmit={goToRequirements}>
                <div className="modal-body booking-edit-fields">
                  <label className="form-label" htmlFor={`booking-date-${booking.id}`}>
                    Date
                    <input
                      id={`booking-date-${booking.id}`}
                      className="form-control"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>
                  <label className="form-label" htmlFor={`booking-time-${booking.id}`}>
                    Start time
                    <input
                      id={`booking-time-${booking.id}`}
                      className="form-control"
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      required
                    />
                  </label>
                  <label
                    className="form-label"
                    htmlFor={`booking-guests-${booking.id}`}
                  >
                    Number of guests
                    <input
                      id={`booking-guests-${booking.id}`}
                      className="form-control"
                      type="number"
                      min="1"
                      step="1"
                      value={numberOfPeople}
                      onChange={(event) =>
                        setNumberOfPeople(event.target.value)
                      }
                      required
                    />
                  </label>
                  {error && (
                    <p className="form-error mb-0" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary py-2 px-0"
                    onClick={onClose}
                    disabled={checking}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary py-2"
                    disabled={checking}
                  >
                    {checking ? "Checking..." : "Next"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveChanges}>
                <div className="modal-body booking-edit-fields">
                  <section className="booking-edit-requirements">
                    <div className="requirements-heading">
                      <div>
                        <h3>Party requirements</h3>
                      </div>
                    </div>
                    {dietaryRequirements.length > 0 ? (
                      <RequirementsList
                        partyRequirements={dietaryRequirements}
                        onRemove={removeRequirement}
                      />
                    ) : (
                      <p className="requirements-empty">
                        Add any allergies or dietary requirements. Mark allergies to alert staff.
                      </p>
                    )}
                    {addingRequirement ? (
                      <div className="booking-edit-add-form mt-3">
                        <label
                          className="form-label"
                          htmlFor={`booking-new-requirement-${booking.id}`}
                        >
                          Requirement description
                          <textarea
                            id={`booking-new-requirement-${booking.id}`}
                            className="form-control"
                            rows="3"
                            value={newRequirementDescription}
                            onChange={(event) =>
                              setNewRequirementDescription(event.target.value)
                            }
                            placeholder="For example, peanut allergy or vegetarian meal"
                            required
                          />
                        </label>
                        <label
                          className="checkbox-label"
                          htmlFor={`booking-new-requirement-allergy-${booking.id}`}
                        >
                          <input
                            id={`booking-new-requirement-allergy-${booking.id}`}
                            type="checkbox"
                            checked={newRequirementIsAllergy}
                            onChange={(event) =>
                              setNewRequirementIsAllergy(event.target.checked)
                            }
                          />
                          This is an allergy
                        </label>
                        <div className="booking-edit-add-form-actions">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={closeRequirementForm}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn booking-edit-add-requirement"
                            onClick={addRequirement}
                            disabled={!newRequirementDescription.trim()}
                          >
                            Add requirement
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="d-flex justify-content-end">
                        <button
                          type="button"
                          className="btn booking-edit-add-requirement mt-3"
                          onClick={() => setAddingRequirement(true)}
                        >
                          <span className="bi bi-plus-lg me-2" aria-hidden="true" />
                          Add requirement
                        </button>
                      </div>
                    )}
                  </section>
                  {error && (
                    <p className="form-error mb-0" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div className="modal-footer booking-edit-step-two-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary py-2 px-0"
                    onClick={() => {
                      setError("");
                      setStep(1);
                    }}
                    disabled={saving}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary py-2"
                    disabled={saving || !bookingChanged || addingRequirement}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function BookingCard({ booking, onBookingUpdated }) {
  const [editing, setEditing] = useState(false);
  const canEdit = !slotStartsWithinEditWindow(booking.slot);

  return (
    <article className="hiker-booking-card">
      <div className="hiker-booking-card-heading">
        <div>
          <h2>{booking.slot?.meal || "Mountain hut booking"}</h2>
          <p>
            {formatDate(booking.slot?.date)} from{" "}
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
              {booking.tables.length === 1
                ? `Table ${booking.tables[0].tableNumber}`
                : booking.tables
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
            <dd>{getDietaryText(booking.dietaryRequirements).replace(/\n/g, ", ")}</dd>
          </div>
        )}
      </dl>

      {canEdit && !editing && (
        <button
          type="button"
          className="btn booking-modify-button"
          onClick={() => setEditing(true)}
        >
          <i className="bi bi-pencil me-2" aria-hidden="true" />
          Modify booking
        </button>
      )}

      {editing && (
        <BookingEditModal
          booking={booking}
          onClose={() => setEditing(false)}
          onBookingUpdated={onBookingUpdated}
        />
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
