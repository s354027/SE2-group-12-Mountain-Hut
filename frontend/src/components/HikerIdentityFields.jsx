import { useEffect, useState } from "react";
import { api } from "../api/client.js";

// Keep in sync with backend/src/services/bookingService.js (EMAIL_REGEX).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const MODES = [
  { value: "EXISTING", label: "Existing hiker" },
  { value: "FULL", label: "New hiker account" },
  { value: "QUICK", label: "Quick entry" },
];

/**
 * Lets staff identify the hiker a booking is entered for (MH-07 / MH-81).
 *
 * `value` only seeds the initially selected mode (e.g. to resume a draft);
 * it is not re-synced afterwards. `onChange` is called with the exact hiker
 * payload the staff booking API expects as soon as the current mode's data
 * is valid, and with `null` whenever it isn't (switching mode, incomplete
 * or invalid fields). To reset the fields after a successful submission,
 * remount this component with a new `key` rather than passing a new value.
 */
export default function HikerIdentityFields({ value, onChange }) {
  const [mode, setMode] = useState(value?.mode ?? "EXISTING");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedHiker, setSelectedHiker] = useState(null);

  const [fullForm, setFullForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
    emergencyContact: "",
  });

  const [quickForm, setQuickForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    onChange(null);
  }

  useEffect(() => {
    if (mode !== "EXISTING" || selectedHiker) return;

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearchError("");
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const hikers = await api.get(`/hikers/search?q=${encodeURIComponent(trimmed)}`);
        setResults(hikers);
        setSearchError("");
      } catch (err) {
        setSearchError(err.message || "Could not search for hikers.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query, mode, selectedHiker]);

  function selectHiker(hiker) {
    setSelectedHiker(hiker);
    setResults([]);
    onChange({ mode: "EXISTING", id: hiker.id });
  }

  function clearSelectedHiker() {
    setSelectedHiker(null);
    setQuery("");
    onChange(null);
  }

  function updateFullField(field, fieldValue) {
    const next = { ...fullForm, [field]: fieldValue };
    setFullForm(next);

    const firstName = next.firstName.trim();
    const lastName = next.lastName.trim();
    const email = next.email.trim().toLowerCase();
    const phone = next.phone.trim();

    if (!firstName || !lastName || !email || !phone || !EMAIL_REGEX.test(email)) {
      onChange(null);
      return;
    }

    onChange({
      mode: "FULL",
      firstName,
      lastName,
      email,
      phone,
      ...(next.notes.trim() ? { notes: next.notes.trim() } : {}),
      ...(next.emergencyContact.trim() ? { emergencyContact: next.emergencyContact.trim() } : {}),
    });
  }

  function updateQuickField(field, fieldValue) {
    const next = { ...quickForm, [field]: fieldValue };
    setQuickForm(next);

    const firstName = next.firstName.trim();
    if (!firstName) {
      onChange(null);
      return;
    }

    onChange({
      mode: "QUICK",
      firstName,
      ...(next.lastName.trim() ? { lastName: next.lastName.trim() } : {}),
      ...(next.phone.trim() ? { phone: next.phone.trim() } : {}),
    });
  }

  const emailTouched = fullForm.email.trim() !== "";
  const emailInvalid = emailTouched && !EMAIL_REGEX.test(fullForm.email.trim());

  return (
    <div className="hiker-identity">
      <div
        className="hiker-identity-tabs"
        role="tablist"
        aria-label="Hiker identification mode"
      >
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={mode === option.value}
            className={`hiker-identity-tab ${mode === option.value ? "active" : ""}`}
            onClick={() => switchMode(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "EXISTING" && (
        <div className="hiker-identity-panel">
          {selectedHiker ? (
            <div className="hiker-selected-card">
              <div>
                <strong>
                  {selectedHiker.firstName} {selectedHiker.lastName}
                </strong>
                <span className="hiker-selected-meta">
                  {selectedHiker.email || selectedHiker.phone || "No contact on file"}
                </span>
              </div>
              <button type="button" className="btn-secondary" onClick={clearSelectedHiker}>
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="hiker-search">Search by name, phone or email</label>
                <input
                  id="hiker-search"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. Anna Rossi"
                />
              </div>
              {searching && <p className="hiker-search-status">Searching…</p>}
              {searchError && (
                <p role="alert" className="form-error">
                  {searchError}
                </p>
              )}
              {!searching &&
                !searchError &&
                query.trim().length >= MIN_QUERY_LENGTH &&
                results.length === 0 && (
                  <p className="hiker-search-status">
                    No hiker found for &quot;{query.trim()}&quot;.
                  </p>
                )}
              {results.length > 0 && (
                <ul className="hiker-search-results">
                  {results.map((hiker) => (
                    <li key={hiker.id}>
                      <button type="button" onClick={() => selectHiker(hiker)}>
                        <strong>
                          {hiker.firstName} {hiker.lastName}
                        </strong>
                        <span>{hiker.email || hiker.phone || "No contact on file"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {mode === "FULL" && (
        <div className="hiker-identity-panel">
          <p className="hiker-identity-hint">
            Creates a regular hiker account. A temporary password will be generated for you
            to share with the hiker.
          </p>
          <div className="field">
            <label htmlFor="hiker-full-firstName">First name *</label>
            <input
              id="hiker-full-firstName"
              type="text"
              value={fullForm.firstName}
              onChange={(event) => updateFullField("firstName", event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="hiker-full-lastName">Last name *</label>
            <input
              id="hiker-full-lastName"
              type="text"
              value={fullForm.lastName}
              onChange={(event) => updateFullField("lastName", event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="hiker-full-email">Email *</label>
            <input
              id="hiker-full-email"
              type="email"
              value={fullForm.email}
              onChange={(event) => updateFullField("email", event.target.value)}
              required
            />
            {emailInvalid && (
              <small className="hiker-field-error">Enter a valid email address.</small>
            )}
          </div>
          <div className="field">
            <label htmlFor="hiker-full-phone">Mobile number *</label>
            <input
              id="hiker-full-phone"
              type="tel"
              value={fullForm.phone}
              onChange={(event) => updateFullField("phone", event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="hiker-full-notes">Notes</label>
            <input
              id="hiker-full-notes"
              type="text"
              value={fullForm.notes}
              onChange={(event) => updateFullField("notes", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="hiker-full-emergencyContact">Emergency contact</label>
            <input
              id="hiker-full-emergencyContact"
              type="text"
              value={fullForm.emergencyContact}
              onChange={(event) => updateFullField("emergencyContact", event.target.value)}
            />
          </div>
        </div>
      )}

      {mode === "QUICK" && (
        <div className="hiker-identity-panel">
          <p className="hiker-identity-hint">
            Creates a temporary entry with no login access, for a fast walk-in or phone
            booking.
          </p>
          <div className="field">
            <label htmlFor="hiker-quick-firstName">Name *</label>
            <input
              id="hiker-quick-firstName"
              type="text"
              value={quickForm.firstName}
              onChange={(event) => updateQuickField("firstName", event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="hiker-quick-lastName">Last name</label>
            <input
              id="hiker-quick-lastName"
              type="text"
              value={quickForm.lastName}
              onChange={(event) => updateQuickField("lastName", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="hiker-quick-phone">Phone</label>
            <input
              id="hiker-quick-phone"
              type="tel"
              value={quickForm.phone}
              onChange={(event) => updateQuickField("phone", event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
