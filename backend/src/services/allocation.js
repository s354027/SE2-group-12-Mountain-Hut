import { models } from '../db/index.js';
import { findFreeTables } from './tableAvailability.js';
import { splitParty } from './partySplit.js';

/**
 * Converts a time ("HH:MM" or "HH:MM:SS") to minutes from the start of the day.
 * Es: "12:30:00" -> 12 * 60 + 30 = 750 minutes.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Table allocation and availability verification algorithm (MH-01 & MH-04).
 * 
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} startTime - starting time (es. "12:00:00")
 * @param {number} partySize - number of people
 * @returns {Promise<Object>} Structured result with availability and detail of places
 * Verify that the time falls within a slot and is at least 20 minutes from its end.
 */
export async function allocateTables(date, startTime, partySize) {
  const { Slot } = models;
  const numPartySize = Number(partySize);
  const reqMinutes = timeToMinutes(startTime);

  // 1. Retrieve all open slots for the selected date
  const openSlots = await Slot.findAll({
    where: { date, status: 'OPEN' },
    order: [['startTime', 'ASC']]
  });

  if (!openSlots || openSlots.length === 0) {
    return {
      available: false,
      reason: 'No service available for the selected date',
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 2. Find the slot where the entered time falls [startTime, startTime + duration)
  const currentSlot = openSlots.find(slot => {
    const start = timeToMinutes(slot.startTime);
    const end = start + slot.duration;
    return reqMinutes >= start && reqMinutes < end;
  });

  // If the time does not fall into a valid slot
  if (!currentSlot) {
    return {
      available: false,
      reason: 'The entered time does not fall within any service slot',
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 3. Verify that startTime is at least 20 minutes before the end of the slot
  const currentStart = timeToMinutes(currentSlot.startTime);
  const currentEnd = currentStart + currentSlot.duration;
  const remainingMinutes = currentEnd - reqMinutes;

  if (remainingMinutes < 20) {
    return {
      available: false,
      reason: 'The requested time must be entered at least 20 minutes before the end of the slot',
      slotId: currentSlot.id,
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 4. Check the actual availability of tables
  const freeTables = await findFreeTables(currentSlot.id);
  if (!freeTables || freeTables.length === 0) {
    return {
      available: false,
      reason: `No table available for the slot of the ${currentSlot.startTime.slice(0, 5)}`,
      slotId: currentSlot.id,
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 5. Calculate the optimal combination of tables
  const allocatedTables = splitParty(numPartySize, freeTables);

  if (!allocatedTables) {
    return {
      available: false,
      reason: `Insufficient places for slot of ${currentSlot.startTime.slice(0, 5)}`,
      slotId: currentSlot.id,
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 6. Format the explicit detail of the division of posts (Requirement MH-04)
  const breakdownSeats = allocatedTables.map(t => t.allocatedSeats).join(' + ');
  const breakdown = `${breakdownSeats} seats`;
  const slotStartFormatted = currentSlot.startTime.slice(0, 5);

  return {
    available: true,
    slotId: currentSlot.id,
    date: currentSlot.date,
    startTime: currentSlot.startTime,
    meal: currentSlot.meal,
    partySize: numPartySize,
    tables: allocatedTables,
    breakdown: breakdown, // Es. "2 + 3 + 1 seats"
    summary: `Available seat in the slot of the ${slotStartFormatted} (${breakdown})`
  };
}