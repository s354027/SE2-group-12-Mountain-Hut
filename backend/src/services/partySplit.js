function combinations(items, size, start = 0, current = []) {
  if (current.length === size) {
    return [current];
  }

  const result = [];

  for (let i = start; i < items.length; i++) {
    result.push(...combinations(items, size, i + 1, [...current, items[i]]));
  }

  return result;
}

/**
 * Calculate the best combination of tables for a given group (partySize).
 * Try first with 1 table, then with 2, up to the total number of tables available,
 * choosing the combination that minimizes wasted seats and, for the same waste,
 * the number of tables used (Requirement MH-01).
 * 
 * @param {number} partySize - Number of people to be accommodated
 * @param {Array} freeTables - Available tables with residual capacity (.seats)
 * @returns {Array|null} Table array with allocated seats (allocatedSeats) or null
 */
export function splitParty(partySize, freeTables) {
  if (!freeTables || freeTables.length === 0 || partySize <= 0) {
    return null;
  }

  let best = null;

  // Evaluate all possible table combinations (1 to N free tables)
  for (let size = 1; size <= freeTables.length; size++) {
    for (const combo of combinations(freeTables, size)) {
      const totalSeats = combo.reduce((sum, table) => sum + table.seats, 0);

      if (totalSeats < partySize) {
        continue;
      }

      const waste = totalSeats - partySize;

      if (!best || waste < best.waste || (waste === best.waste && combo.length < best.tables.length)) {
        best = { tables: combo, waste };
      }
    }
  }

  if (!best) {
    return null;
  }

  // Calculate exactly how many group seats are allocated on each table
  let remainingParty = partySize;
  const allocatedTables = best.tables.map(table => {
    const allocated = Math.min(remainingParty, table.seats);
    remainingParty -= allocated;
    return {
      ...table,
      allocatedSeats: allocated
    };
  });

  return allocatedTables;
}