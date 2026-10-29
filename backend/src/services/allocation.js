import { models } from '../db/index.js';
import { findFreeTables } from './tableAvailability.js';
import { splitParty } from './partySplit.js';

/**
 * Table allocation and availability verification algorithm (MH-01 & MH-04).
 * 
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} startTime - starting time (es. "12:00:00")
 * @param {number} partySize - number of people
 * @returns {Promise<Object>} Structured result with availability and detail of places
 */
export async function allocateTables(date, startTime, partySize) {
  const { Slot } = models;
  const numPartySize = Number(partySize);

  // 1. Search for the corresponding slot
  const slot = await Slot.findOne({
    where: { date, startTime }
  });

  if (!slot) {
    return {
      available: false,
      reason: 'No slot found for given date and time',
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 2. Recover tables that are free or have residual capacity (Table Sharing)
  const freeTables = await findFreeTables(slot.id);

  if (!freeTables || freeTables.length === 0) {
    return {
      available: false,
      reason: 'No available tables in this time slot',
      slotId: slot.id,
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 3. Calculate the optimal combination of tables
  const allocatedTables = splitParty(numPartySize, freeTables);

  if (!allocatedTables) {
    return {
      available: false,
      reason: 'Insufficient seats or valid table arrangement not possible',
      slotId: slot.id,
      partySize: numPartySize,
      tables: [],
      breakdown: null
    };
  }

  // 4. Format the explicit detail of the division of posts (Requirement MH-04)
  const breakdownSeats = allocatedTables.map(t => t.allocatedSeats).join(' + ');
  const breakdown = `${breakdownSeats} seats`;

  return {
    available: true,
    slotId: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    partySize: numPartySize,
    tables: allocatedTables,
    breakdown: breakdown, // Es. "2 + 3 + 1 seats"
    summary: `Party of ${numPartySize} available (${breakdown})`
  };
}