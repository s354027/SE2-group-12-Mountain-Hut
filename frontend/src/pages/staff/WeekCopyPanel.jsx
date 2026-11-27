// MH-96 (MH-09 Repeat a weekly schedule): copy the slots of a week onto other weeks.
// A target week with an existing schedule is fully replaced (after confirmation),
// unless it has reservations: in that case the backend refuses the whole copy.
import { useState } from 'react';
import { api } from '../../api/client.js';
import { addDays, dateKey, parseDateKey, startOfWeek } from './weekDates.js';

const TARGET_WEEKS_SHOWN = 12;

function shortDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function weekLabel(mondayKey) {
  const monday = parseDateKey(mondayKey);
  return `${shortDate(monday)} – ${shortDate(addDays(monday, 6))} ${addDays(monday, 6).getFullYear()}`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function mealLabel(meal) {
  return meal === 'DINNER' ? 'Dinner' : 'Lunch';
}

function weekOf(slot) {
  return dateKey(startOfWeek(parseDateKey(slot.date)));
}

// Number of slots per week, keyed by the week's Monday ('YYYY-MM-DD').
function countSlotsByWeek(slots) {
  const counts = new Map();
  for (const slot of slots) {
    const monday = weekOf(slot);
    counts.set(monday, (counts.get(monday) || 0) + 1);
  }
  return counts;
}

// Weeks (Monday keys) that contain at least one slot with active bookings (PENDING / CONFIRMED):
// they cannot be replaced. Cancelled bookings do not block the copy.
function weeksWithBookings(slots) {
  return new Set(slots.filter((slot) => Number(slot.activeBookingCount) > 0).map(weekOf));
}

// The first Monday not in the past: a week that has already started cannot be a target.
function firstSelectableMonday(today) {
  const monday = startOfWeek(today);
  return dateKey(monday) === dateKey(today) ? monday : addDays(monday, 7);
}

// Slots of the source week grouped by day, to show what is going to be copied.
function weekPreview(slots, monday) {
  const days = new Map();
  slots
    .filter((slot) => weekOf(slot) === monday)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.startTime).localeCompare(String(b.startTime)))
    .forEach((slot) => {
      if (!days.has(slot.date)) days.set(slot.date, []);
      days.get(slot.date).push(slot);
    });
  return [...days.entries()];
}

function Step({ number, title, children }) {
  return (
    <div className="week-copy-step">
      <h4 className="week-copy-step-title">
        <span className="week-copy-step-number" aria-hidden="true">{number}</span>
        <span>Step {number} – {title}</span>
      </h4>
      {children}
    </div>
  );
}

export default function WeekCopyPanel({ slots, onCopied }) {
  const [sourceWeek, setSourceWeek] = useState('');
  const [targetWeeks, setTargetWeeks] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const slotsByWeek = countSlotsByWeek(slots);
  const sourceOptions = [...slotsByWeek.keys()].sort((a, b) => a.localeCompare(b));
  const bookedWeeks = weeksWithBookings(slots);

  const firstMonday = firstSelectableMonday(new Date());
  const targetOptions = Array.from({ length: TARGET_WEEKS_SHOWN }, (_, i) => dateKey(addDays(firstMonday, i * 7)))
    .filter((week) => week !== sourceWeek);

  const sortedTargets = [...targetWeeks].sort((a, b) => a.localeCompare(b));
  const weeksToReplace = sortedTargets.filter((week) => slotsByWeek.has(week));
  const sourceSlotCount = slotsByWeek.get(sourceWeek) || 0;

  function resetFeedback() {
    setError(null);
    setResult(null);
  }

  function updateTargets(next) {
    setTargetWeeks(next);
    setConfirming(false);
    resetFeedback();
  }

  function changeSource(event) {
    const week = event.target.value;
    setSourceWeek(week);
    updateTargets(targetWeeks.filter((target) => target !== week));
  }

  function toggleTarget(week) {
    if (bookedWeeks.has(week)) return; // weeks with reservations cannot be replaced
    updateTargets(targetWeeks.includes(week) ? targetWeeks.filter((w) => w !== week) : [...targetWeeks, week]);
  }

  async function requestCopy() {
    resetFeedback();
    if (weeksToReplace.length > 0) {
      setConfirming(true);
      return;
    }
    await copy();
  }

  async function copy() {
    setConfirming(false);
    setCopying(true);
    try {
      const response = await api.post('/slots/copy-week', {
        sourceWeekStart: sourceWeek,
        targetWeekStarts: sortedTargets,
      });
      setResult(response.weeks);
      setTargetWeeks([]);
      await onCopied?.();
    } catch (err) {
      setError({
        message: err.message || 'Could not copy the weekly schedule.',
        hasBookings: err.status === 409,
      });
    } finally {
      setCopying(false);
    }
  }

  let summary;
  if (!sourceWeek) {
    summary = 'Choose the week to copy (step 1).';
  } else if (targetWeeks.length === 0) {
    summary = 'Choose at least one target week (step 2).';
  } else {
    const replaced = weeksToReplace.length > 0
      ? ` ${plural(weeksToReplace.length, 'week')} already ${weeksToReplace.length === 1 ? 'has' : 'have'} a schedule and will be replaced.`
      : '';
    summary = `You are copying ${plural(sourceSlotCount, 'slot')} from ${weekLabel(sourceWeek)} to ${plural(targetWeeks.length, 'week')}.${replaced}`;
  }

  const canCopy = Boolean(sourceWeek) && targetWeeks.length > 0 && !copying;

  return (
    <section className="week-copy" aria-labelledby="week-copy-title">
      <h3 id="week-copy-title">Repeat a weekly schedule</h3>

      <div className="week-copy-info" aria-label="How it works">
        <strong>How it works</strong>
        <ul>
          <li>All the slots of the chosen week are copied to the same days of the target weeks.</li>
          <li>If a target week already has slots, its schedule is <strong>completely replaced</strong>.</li>
          <li>Weeks with reservations cannot be replaced.</li>
        </ul>
      </div>

      {sourceOptions.length === 0 ? (
        <p className="week-copy-hint">There are no slots to copy yet. Add the slots of a week below, then come back here to repeat it.</p>
      ) : (
        <>
          <Step number={1} title="Choose the week to copy">
            <div className="field week-copy-source">
              <label htmlFor="week-copy-source">Week to copy</label>
              <select id="week-copy-source" value={sourceWeek} onChange={changeSource} disabled={copying}>
                <option value="">Select a week…</option>
                {sourceOptions.map((week) => (
                  <option key={week} value={week}>
                    {weekLabel(week)} ({plural(slotsByWeek.get(week), 'slot')})
                  </option>
                ))}
              </select>
            </div>
            {sourceWeek && (
              <div className="week-copy-preview" aria-label="Slots that will be copied">
                <p className="week-copy-hint">These slots will be copied:</p>
                <ul>
                  {weekPreview(slots, sourceWeek).map(([day, daySlots]) => (
                    <li key={day}>
                      <strong>{shortDate(parseDateKey(day))}:</strong>{' '}
                      {daySlots
                        .map((slot) => `${String(slot.startTime).slice(0, 5)} ${mealLabel(slot.meal)} (${slot.totalCapacity} seats)`)
                        .join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Step>

          <Step number={2} title="Choose the target weeks">
            {!sourceWeek ? (
              <p className="week-copy-hint">Select a week to copy first.</p>
            ) : (
              <>
                <p className="week-copy-hint">Only weeks that have not started yet are listed. You can select more than one.</p>
                <div className="week-copy-quick">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => updateTargets([])}
                    disabled={copying || targetWeeks.length === 0}
                  >
                    Clear
                  </button>
                </div>
                <fieldset className="week-copy-targets">
                  <legend>Copy to</legend>
                  {targetOptions.map((week) => {
                    const existing = slotsByWeek.get(week) || 0;
                    const hasBookings = bookedWeeks.has(week);
                    return (
                      <label
                        key={week}
                        className={`week-copy-target${hasBookings ? ' week-copy-target-disabled' : ''}`}
                        title={hasBookings ? 'This week has reservations and cannot be replaced' : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={!hasBookings && targetWeeks.includes(week)}
                          onChange={() => toggleTarget(week)}
                          disabled={copying || hasBookings}
                        />
                        <span>{weekLabel(week)}</span>
                        {hasBookings ? (
                          <span className="week-copy-tag week-copy-tag-booked">Has bookings</span>
                        ) : existing > 0 ? (
                          <span className="week-copy-tag week-copy-tag-replace">
                            {plural(existing, 'slot')} – will be replaced
                          </span>
                        ) : (
                          <span className="week-copy-tag week-copy-tag-empty">Empty</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              </>
            )}
          </Step>

          <Step number={3} title="Review and copy">
            <p className="week-copy-summary" aria-live="polite">{summary}</p>

            {confirming ? (
              <div role="alertdialog" aria-labelledby="week-copy-confirm-title" className="week-copy-confirm">
                <p id="week-copy-confirm-title">
                  <strong>The existing schedule of these weeks will be completely replaced:</strong>
                </p>
                <ul>
                  {weeksToReplace.map((week) => (
                    <li key={week}>{weekLabel(week)} ({plural(slotsByWeek.get(week), 'slot')})</li>
                  ))}
                </ul>
                <div className="week-copy-actions">
                  <button type="button" className="btn-primary" onClick={copy}>Replace and copy</button>
                  <button type="button" className="btn-cancel" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="week-copy-actions">
                <button type="button" className="btn-primary" onClick={requestCopy} disabled={!canCopy}>
                  {copying
                    ? 'Copying...'
                    : targetWeeks.length > 0
                      ? `Copy to ${plural(targetWeeks.length, 'week')}`
                      : 'Copy week'}
                </button>
              </div>
            )}
          </Step>
        </>
      )}

      {error && (
        <div role="alert" className="form-error week-copy-error">
          <p>{error.message}</p>
          {error.hasBookings && (
            <p>Nothing was copied. Remove that week from the selection, or cancel its reservations first, then try again.</p>
          )}
        </div>
      )}
      {result && (
        <div role="status" className="week-copy-success">
          <p><strong>Schedule copied to {plural(result.length, 'week')}:</strong></p>
          <ul>
            {result.map((week) => (
              <li key={week.weekStart}>
                {weekLabel(week.weekStart)}: {plural(week.createdSlots.length, 'slot')} created
                {week.replacedSlots > 0 && `, ${plural(week.replacedSlots, 'old slot')} replaced`}
              </li>
            ))}
          </ul>
          <p>The new slots are now in the calendar above.</p>
        </div>
      )}
    </section>
  );
}
