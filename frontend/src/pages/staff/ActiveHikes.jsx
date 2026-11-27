import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import "./ActiveHikes.css";

const DUE_SOON_THRESHOLD_MS = 30 * 60 * 1000;
const HIKES_PER_PAGE = 2;
const REFRESH_INTERVAL_MS = 60 * 1000;
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "on-track", label: "On track" },
  { value: "overdue", label: "Overdue" },
];

function toTimestamp(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function formatDateTime(value) {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return "Invalid date and time";

  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getReturnStatus(value, now) {
  const expectedReturn = toTimestamp(value);
  if (!Number.isFinite(expectedReturn)) {
    return { label: "Unknown", className: "unknown" };
  }

  const timeRemaining = expectedReturn - now;
  if (timeRemaining < 0) {
    return { label: "Overdue", className: "overdue" };
  }
  if (timeRemaining < DUE_SOON_THRESHOLD_MS) {
    return { label: "Due soon", className: "due-soon" };
  }
  return { label: "On track", className: "on-track" };
}

function getHikerName(hiker) {
  const name = [hiker?.firstName, hiker?.lastName].filter(Boolean).join(" ");
  return name || "Hiker details unavailable";
}

function getReturnTimestamp(hike) {
  const timestamp = toTimestamp(hike.expectedReturnTime);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

export default function ActiveHikes() {
  const [hikes, setHikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let isMounted = true;
    let requestPending = false;

    async function loadHikes() {
      if (requestPending) return;
      requestPending = true;

      try {
        const result = await api.get("/hikes/active");
        if (!Array.isArray(result)) {
          throw new Error("Unexpected response while loading active hikes.");
        }
        if (isMounted) {
          setHikes(result);
          setError("");
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message || "Could not load active hikes.");
        }
      } finally {
        requestPending = false;
        if (isMounted) setLoading(false);
      }
    }

    void loadHikes();
    const intervalId = window.setInterval(() => {
      void loadHikes();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const statusCounts = hikes.reduce(
    (counts, hike) => {
      const { className } = getReturnStatus(hike.expectedReturnTime, now);
      if (className in counts) counts[className] += 1;
      return counts;
    },
    { "on-track": 0, overdue: 0 },
  );
  const visibleHikes = hikes
    .filter(
      (hike) =>
        statusFilter === "all" ||
        getReturnStatus(hike.expectedReturnTime, now).className ===
          statusFilter,
    )
    .sort(
      (first, second) => getReturnTimestamp(first) - getReturnTimestamp(second),
    );
  const pageCount = Math.ceil(visibleHikes.length / HIKES_PER_PAGE);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(pageCount, 1)));
  }, [pageCount]);

  const pageNumber = Math.min(currentPage, Math.max(pageCount, 1));
  const pageHikes = visibleHikes.slice(
    (pageNumber - 1) * HIKES_PER_PAGE,
    pageNumber * HIKES_PER_PAGE,
  );
  const selectedFilterLabel = STATUS_FILTERS.find(
    (filter) => filter.value === statusFilter,
  )?.label;

  return (
    <section className="active-hikes-page">
      <header className="active-hikes-heading">
        <div>
          <span className="active-hikes-eyebrow">STAFF MONITORING</span>
          <h1>Active hikes</h1>
          <p>
            Review hikers with an open registration and their expected return
            times.
          </p>
        </div>
        {!loading && !error && (
          <span className="active-hikes-count">
            {visibleHikes.length} {visibleHikes.length === 1 ? "hike" : "hikes"}
          </span>
        )}
      </header>

      {loading ? (
        <p className="active-hikes-message" role="status">
          Loading active hikes...
        </p>
      ) : error ? (
        <p className="active-hikes-message active-hikes-error" role="alert">
          {error}
        </p>
      ) : hikes.length === 0 ? (
        <p className="active-hikes-message">
          There are no active hikes to display.
        </p>
      ) : (
        <>
          <div className="active-hikes-toolbar">
            <div
              className="active-hike-filters"
              role="group"
              aria-label="Filter hikes by return status"
            >
              {STATUS_FILTERS.map((filter) => {
                const count =
                  filter.value === "all"
                    ? hikes.length
                    : statusCounts[filter.value];
                const showCount = filter.value !== "all" && count > 0;

                return (
                  <button
                    className={`active-hike-filter active-hike-filter--${filter.value}`}
                    type="button"
                    key={filter.value}
                    aria-pressed={statusFilter === filter.value}
                    onClick={() => {
                      setStatusFilter(filter.value);
                      setCurrentPage(1);
                    }}
                  >
                    {filter.label}
                    {showCount ? ` (${count})` : ""}
                  </button>
                );
              })}
            </div>
            <p className="active-hikes-sort-note">
              Sorted by expected return time, soonest first.
            </p>
          </div>

          {visibleHikes.length === 0 ? (
            <div
              className="active-hikes-message active-hikes-filter-empty"
              role="status"
            >
              <p>
                {statusFilter === "overdue"
                  ? "No overdue hikes right now."
                  : `No hikes are currently ${selectedFilterLabel?.toLowerCase()}.`}
              </p>
              <button
                type="button"
                className="active-hikes-show-all"
                onClick={() => setStatusFilter("all")}
              >
                Show all hikes
              </button>
            </div>
          ) : (
            <>
              <ul className="active-hikes-list">
                {pageHikes.map((hike) => {
                  const returnStatus = getReturnStatus(
                    hike.expectedReturnTime,
                    now,
                  );

                  return (
                    <li key={hike.id}>
                      <article className="active-hike-card">
                        <header className="active-hike-card-heading">
                          <div className="active-hike-identity">
                            <div className="active-hike-identity-label">
                              <span className="active-hike-label">HIKER</span>
                            </div>
                            <h2>{getHikerName(hike.hiker)}</h2>
                          </div>
                          <div className="active-hike-return">
                            <span>Expected return</span>
                            <time dateTime={hike.expectedReturnTime}>
                              {formatDateTime(hike.expectedReturnTime)}
                            </time>
                            {/*<span
                            className={`active-hike-status active-hike-status--${returnStatus.className}`}
                          >
                            {returnStatus.label}
                          </span>*/}
                          </div>
                        </header>

                        <dl className="active-hike-details">
                          <div>
                            <dt>Destination</dt>
                            <dd>{hike.destination}</dd>
                          </div>
                          <div>
                            <dt>Planned departure</dt>
                            <dd>
                              <time dateTime={hike.departureTime}>
                                {formatDateTime(hike.departureTime)}
                              </time>
                            </dd>
                          </div>
                        </dl>

                        <section className="active-hike-route">
                          <h3>Route</h3>
                          <p>{hike.route || "No route provided."}</p>
                        </section>

                        <section className="active-hike-waypoints">
                          <h3>Intermediate points</h3>
                          {Array.isArray(hike.waypoints) &&
                          hike.waypoints.length > 0 ? (
                            <ul>
                              {hike.waypoints.map((waypoint, index) => (
                                <li key={`${waypoint}-${index}`}>{waypoint}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>None specified.</p>
                          )}
                        </section>
                      </article>
                    </li>
                  );
                })}
              </ul>
              {pageCount > 1 && (
                <nav
                  className="active-hike-pagination"
                  aria-label="Active hikes pages"
                >
                  <ul className="pagination justify-content-end">
                    <li
                      className={`page-item${pageNumber === 1 ? " disabled" : ""}`}
                    >
                      <button
                        className="page-link"
                        type="button"
                        aria-label="Previous page"
                        onClick={() => setCurrentPage(pageNumber - 1)}
                        disabled={pageNumber === 1}
                      >
                        <span aria-hidden="true">&lt;</span>
                      </button>
                    </li>
                    {Array.from({ length: pageCount }, (_, index) => {
                      const page = index + 1;
                      const isCurrentPage = page === pageNumber;

                      return (
                        <li
                          className={`page-item${isCurrentPage ? " active" : ""}`}
                          key={page}
                        >
                          <button
                            className="page-link"
                            type="button"
                            aria-current={isCurrentPage ? "page" : undefined}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        </li>
                      );
                    })}
                    <li
                      className={`page-item${pageNumber === pageCount ? " disabled" : ""}`}
                    >
                      <button
                        className="page-link"
                        type="button"
                        aria-label="Next page"
                        onClick={() => setCurrentPage(pageNumber + 1)}
                        disabled={pageNumber === pageCount}
                      >
                        <span aria-hidden="true">&gt;</span>
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
