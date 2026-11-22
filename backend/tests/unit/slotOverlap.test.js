import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  slotsOverlap,
  findOverlappingSlot
} from '../../src/services/slotOverlap.js';

describe('timeToMinutes', () => {
  it.each([
    ['00:00', 0],
    ['12:00', 720],
    ['12:00:00', 720],
    ['13:30', 810],
    ['13:30:30', 810.5],
    ['23:59', 1439]
  ])('converts %s to %d minutes', (time, expected) => {
    expect(timeToMinutes(time)).toBe(expected);
  });
});

describe('slotsOverlap (MH-02: no overlap, contiguous allowed)', () => {
  // Existing slot used as reference: 12:00 - 13:00
  it.each([
    ['partial overlap at the start', '11:30', 60, true],
    ['partial overlap at the end', '12:30', 60, true],
    ['new slot fully inside the existing one', '12:15', 30, true],
    ['new slot fully containing the existing one', '11:00', 180, true],
    ['identical slot', '12:00', 60, true],
    ['same start, shorter duration', '12:00', 15, true],
    ['one-minute overlap at the end', '12:59', 60, true],
    ['one-minute overlap at the start', '11:01', 60, true],
    ['contiguous after (12-13 and 13-14)', '13:00', 60, false],
    ['contiguous before (11-12 and 12-13)', '11:00', 60, false],
    ['disjoint: dinner vs lunch', '19:00', 90, false],
    ['disjoint: early morning', '07:00', 60, false]
  ])('%s -> %s', (_label, startTime, duration, expected) => {
    expect(slotsOverlap(startTime, duration, '12:00', 60)).toBe(expected);
  });

  it('is symmetric', () => {
    const cases = [
      ['12:00', 60, '12:30', 60],
      ['12:00', 60, '13:00', 60],
      ['11:00', 180, '12:00', 30],
      ['19:00', 90, '12:00', 60]
    ];

    for (const [sA, dA, sB, dB] of cases) {
      expect(slotsOverlap(sA, dA, sB, dB)).toBe(slotsOverlap(sB, dB, sA, dA));
    }
  });

  it('treats "HH:MM" and "HH:MM:SS" (as returned by the DB) the same way', () => {
    expect(slotsOverlap('12:30', 60, '12:00:00', 60)).toBe(true);
    expect(slotsOverlap('13:00', 60, '12:00:00', 60)).toBe(false);
    expect(slotsOverlap('13:00:00', 60, '12:00', 60)).toBe(false);
  });

  it('accepts durations passed as strings', () => {
    expect(slotsOverlap('12:30', '60', '12:00', '60')).toBe(true);
    expect(slotsOverlap('13:00', '60', '12:00', '60')).toBe(false);
  });
});

describe('findOverlappingSlot', () => {
  const lunch1 = { id: 1, startTime: '12:00:00', duration: 60 };
  const lunch2 = { id: 2, startTime: '13:00:00', duration: 60 };
  const dinner = { id: 3, startTime: '19:00:00', duration: 90 };

  it('returns undefined when there are no slots on that day', () => {
    expect(findOverlappingSlot({ startTime: '12:00', duration: 60 }, [])).toBeUndefined();
  });

  it('returns undefined when the candidate is contiguous to the existing slots', () => {
    expect(
      findOverlappingSlot({ startTime: '14:00', duration: 60 }, [lunch1, lunch2, dinner])
    ).toBeUndefined();
  });

  it('returns undefined when the candidate fits exactly between two slots', () => {
    const before = { id: 1, startTime: '12:00:00', duration: 60 };
    const after = { id: 2, startTime: '14:00:00', duration: 60 };

    expect(
      findOverlappingSlot({ startTime: '13:00', duration: 60 }, [before, after])
    ).toBeUndefined();
  });

  it('returns the slot that overlaps the candidate', () => {
    expect(
      findOverlappingSlot({ startTime: '13:30', duration: 60 }, [lunch1, lunch2, dinner])
    ).toBe(lunch2);
  });

  it('ignores the slot with the given id (the slot being updated)', () => {
    expect(
      findOverlappingSlot({ startTime: '12:00', duration: 60 }, [lunch1], 1)
    ).toBeUndefined();
  });

  it('matches ignoreId regardless of string/number type', () => {
    expect(
      findOverlappingSlot({ startTime: '12:00', duration: 60 }, [lunch1], '1')
    ).toBeUndefined();
  });

  it('still detects overlaps with other slots when ignoring one', () => {
    expect(
      findOverlappingSlot({ startTime: '12:30', duration: 60 }, [lunch1, lunch2], 1)
    ).toBe(lunch2);
  });
});
