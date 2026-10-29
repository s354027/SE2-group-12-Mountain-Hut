import { describe, it, expect } from 'vitest';
import { splitParty } from '../../src/services/partySplit.js';

describe('splitParty', () => {
  it('allocates a party to one table when capacity is sufficient', () => {
    expect(splitParty(3, [
      { id: 1, tableNumber: 1, seats: 4 }
    ])).toEqual([
      { id: 1, tableNumber: 1, seats: 4, allocatedSeats: 3 }
    ]);
  });

  it('uses multiple tables when one table cannot accommodate the party', () => {
    expect(splitParty(6, [
      { id: 1, seats: 4 },
      { id: 2, seats: 4 }
    ])).toEqual([
      { id: 1, seats: 4, allocatedSeats: 4 },
      { id: 2, seats: 4, allocatedSeats: 2 }
    ]);
  });

  it('chooses the combination with the least wasted capacity', () => {
    expect(splitParty(4, [
      { id: 1, seats: 2 },
      { id: 2, seats: 4 },
      { id: 3, seats: 6 }
    ])).toEqual([
      { id: 2, seats: 4, allocatedSeats: 4 }
    ]);
  });

  it('prefers fewer tables when combinations waste the same capacity', () => {
    expect(splitParty(6, [
      { id: 1, seats: 6 },
      { id: 2, seats: 4 },
      { id: 3, seats: 2 }
    ])).toEqual([
      { id: 1, seats: 6, allocatedSeats: 6 }
    ]);
  });

  it('returns null when the party cannot be accommodated', () => {
    expect(splitParty(10, [
      { id: 1, seats: 4 },
      { id: 2, seats: 4 }
    ])).toBeNull();
  });

  it('returns null for an empty table list or non-positive party size', () => {
    expect(splitParty(3, [])).toBeNull();
    expect(splitParty(0, [{ id: 1, seats: 4 }])).toBeNull();
  });
});
