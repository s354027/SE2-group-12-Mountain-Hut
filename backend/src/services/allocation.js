import { models } from '../db/index.js';
import { findFreeTables } from './tableAvailability.js';
import { splitParty } from './partySplit.js';

/**
 * Main table allocation algorithm for availability / reservation verification.
 * 
 * 1. Resolves the Slot starting from the start date and time.
 * 2. Retrieve free tables for that slot via findFreeTables.
 * 3. Find the best table combination (up to 3) through splitParty.
 * 
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} startTime - Start time (e.g. "12:00:00")
 * @param {number} partySize - Number of people in the group
 * @returns {Promise<Array|null>} Array of allocated tables or null if there is no availability
 */
export async function allocateTables(date, startTime, partySize) {
  const { Slot } = models;

  // 1. Search for the corresponding slot
  const slot = await Slot.findOne({
    where: { date, startTime }
  });

  if (!slot) {
    return null; // No slots found = no availability
  }

  // 2. Recover free tables for this slot
  const freeTables = await findFreeTables(slot.id);

  if (!freeTables || freeTables.length === 0) {
    return null;
  }

  // 3. Calculate the optimal combination of tables
  return splitParty(partySize, freeTables);
}