/**
 * MH-02: two slots on the same day cannot overlap, but they can be contiguous
 * (e.g. 12:00-13:00 and 13:00-14:00).
 */

/**
 * Converts a time string ("HH:MM" or "HH:MM:SS") into minutes from midnight.
 */
export function timeToMinutes(time) {
  const [hours, minutes, seconds = 0] = String(time)
    .split(':')
    .map(Number);

  return hours * 60 + minutes + seconds / 60;
}

/**
 * Returns true when the two intervals [start, start + duration) intersect.
 * Contiguous slots (one ends exactly when the other starts) do NOT overlap.
 */
export function slotsOverlap(startTimeA, durationA, startTimeB, durationB) {
  const startA = timeToMinutes(startTimeA);
  const endA = startA + Number(durationA);

  const startB = timeToMinutes(startTimeB);
  const endB = startB + Number(durationB);

  return startA < endB && startB < endA;
}

/**
 * Returns the first slot in `existingSlots` that overlaps `candidate`
 * ({ startTime, duration }), ignoring the slot whose id equals `ignoreId`.
 * Returns undefined when there is no overlap.
 */
export function findOverlappingSlot(candidate, existingSlots, ignoreId) {
  return existingSlots
    .filter((slot) => ignoreId === undefined || String(slot.id) !== String(ignoreId))
    .find((slot) =>
      slotsOverlap(candidate.startTime, candidate.duration, slot.startTime, slot.duration)
    );
}
