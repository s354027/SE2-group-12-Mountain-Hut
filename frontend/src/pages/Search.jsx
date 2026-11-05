import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  return value ? value.slice(0, 5) : "";
}

export default function Search() {
  const navigate = useNavigate();
  const minDate = useMemo(todayLocal, []);
  const [date, setDate] = useState(minDate);
  const [time, setTime] = useState("12:00");
  const [partySize, setPartySize] = useState("2");
  const [result, setResult] = useState(null);
  const [searchedFor, setSearchedFor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  async function handleSearch(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    setSearchedFor({ date, time, partySize: Number(partySize) });

    try {
      const params = new URLSearchParams({
        date,
        startTime: time,
        partySize,
      });
      const availability = await api.get(`/availability?${params.toString()}`);
      setResult(availability);
    } catch (requestError) {
      setError(
        requestError.message ||
          "We couldn't check availability. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function continueToBooking() {
    if (!result?.available) return;
    const state = {
      availability: result,
      date,
      time,
      numberOfPeople: Number(partySize),
    };
    if (!user) {
      navigate("/booking", {
        state: { ...state, afterLogin: "booking" },
      });
    } else {
      navigate("/booking", { state });
    }
  }

  return (
    <div className="field-guide-search">
      <section className="field-guide-hero">
        <div className="field-guide-hero-copy">
          <span className="field-guide-kicker">
            <span /> THE HUT TABLE BOOKING JOURNAL
          </span>
          <p className="field-guide-edition">
            A GOOD MEAL, AT THE END OF A GOOD TRAIL
          </p>
          <h1>
            Find your
            <br />
            <em>place</em> at the table.
          </h1>
          <p className="field-guide-lede">
            Take a pause in the mountains. Choose your day, pick a time, and
            we'll find a table waiting for your party.
          </p>
          <a className="field-guide-text-link" href="#availability-search">
            EXPLORE TABLE AVAILABILITY <span aria-hidden="true">↘</span>
          </a>
        </div>
        <div
          className="field-guide-landscape"
          aria-label="Illustrated mountain landscape"
        >
          <div className="landscape-sun" />
          <div className="landscape-ridge ridge-back" />
          <div className="landscape-ridge ridge-mid" />
          <div className="landscape-ridge ridge-front" />
          <div className="landscape-hut">
            <span />
            <i />
          </div>
          <div className="landscape-caption">ALPINE refuge · EST. 1,860 m</div>
          <div className="landscape-index">
            46° 03' N<br />
            07° 45' E
          </div>
        </div>
        <div className="field-guide-side-note">
          GOOD FOOD · HIGHER GROUND · SLOW MOMENTS
        </div>
      </section>

      <section className="field-guide-search-panel" id="availability-search">
        <div className="search-panel-heading">
          <div>
            <span className="field-guide-kicker">01 / PLAN YOUR STOP</span>
            <h2>When are you coming by?</h2>
          </div>
          <p>
            Search is open to everyone.
            <br />A reservation is confirmed in the next step.
          </p>
        </div>

        <form className="field-guide-form" onSubmit={handleSearch}>
          <label className="guide-field guide-date">
            <span>YOUR DATE</span>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label className="guide-field">
            <span>ARRIVAL TIME</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </label>
          <label className="guide-field guide-party">
            <span>YOUR PARTY</span>
            <select
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (count) => (
                  <option value={count} key={count}>
                    {count} {count === 1 ? "guest" : "guests"}
                  </option>
                ),
              )}
            </select>
          </label>
          <button
            className="guide-search-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "CHECKING..." : "FIND A TABLE"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div className="search-panel-foot">
          <span>✳</span> Please arrive close to your selected time so the hut
          can welcome you.
        </div>
      </section>

      {error && (
        <div className="guide-message guide-error" role="alert">
          <strong>We couldn't complete that search.</strong>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <section className="guide-results" aria-live="polite">
          <div className="guide-results-heading">
            <div>
              <span className="field-guide-kicker">
                02 / YOUR SEARCH RESULTS
              </span>
              <h2>
                {result.available
                  ? "A seat in the mountains."
                  : "Not this time."}
              </h2>
              <p>
                {searchedFor
                  ? `${formatDate(searchedFor.date)} · ${formatTime(searchedFor.time)} · ${searchedFor.partySize} ${searchedFor.partySize === 1 ? "guest" : "guests"}`
                  : ""}
              </p>
            </div>
            <span
              className={`guide-status ${result.available ? "is-available" : "is-unavailable"}`}
            >
              {result.available ? "AVAILABLE" : "UNAVAILABLE"}
            </span>
          </div>

          {result.available ? (
            <article className="guide-result-card">
              <div className="result-card-mark">
                MH<span>·</span>
              </div>
              <div className="result-card-main">
                <span className="field-guide-kicker">
                  YOUR TABLE ALLOCATION
                </span>
                <h3>There's room for your party.</h3>
                <p>
                  {result.summary ||
                    "We found enough seats for your selected party."}
                </p>
                <div className="result-table-list">
                  {(result.tables || []).map((table) => (
                    <div className="result-table-item" key={table.id}>
                      <span className="table-number">
                        TABLE {table.tableNumber}
                      </span>
                      <strong>
                        {table.allocatedSeats}{" "}
                        {table.allocatedSeats === 1 ? "seat" : "seats"}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="result-card-action">
                <span>READY WHEN YOU ARE</span>
                <button type="button" onClick={continueToBooking}>
                  CONTINUE TO BOOKING <span aria-hidden="true">→</span>
                </button>
                <small>You'll review the details before confirming.</small>
              </div>
            </article>
          ) : (
            <div className="guide-unavailable-card">
              <span className="unavailable-symbol">↗</span>
              <div>
                <h3>No table found for this search.</h3>
                <p>
                  {result.reason ||
                    "There isn't a suitable table for those details. Try another time or party size."}
                </p>
                <button
                  type="button"
                  className="guide-retry"
                  onClick={() => {
                    setResult(null);
                    document
                      .getElementById("availability-search")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  ADJUST YOUR SEARCH ↗
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
