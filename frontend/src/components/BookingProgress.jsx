import { Fragment } from "react";

// Shared step indicator for the booking flow (Search -> Booking -> Confirmed).
const STEPS = ["Find a table", "Review booking", "Confirmed"];

export default function BookingProgress({ step }) {
  return (
    <div className="booking-progress" aria-label="Booking progress">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const status =
          stepNumber < step ? "complete" : stepNumber === step ? "current" : "";

        return (
          <Fragment key={label}>
            {index > 0 && <span className="progress-line" />}
            <span className={`progress-step ${status}`.trim()}>
              {stepNumber}. {label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
