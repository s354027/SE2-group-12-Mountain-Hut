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

export function splitParty(partySize, freeTables) {
  let best = null;

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

  return best ? best.tables : null;
}
