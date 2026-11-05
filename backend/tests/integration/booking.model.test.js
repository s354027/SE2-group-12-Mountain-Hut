import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'mh-booking-model-'));
process.env.DB_PATH = join(tmpDir, 'test.sqlite');

const { models } = await import('../../src/db/index.js');

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('Booking model validation', () => {
  const baseAttributes = {
    hikerId: 1,
    slotId: 1,
    numberOfPeople: 2,
    status: 'CONFIRMED'
  };

  it('rejects an allergy flag with no description', async () => {
    const booking = models.Booking.build({
      ...baseAttributes,
      allergyFlag: true,
      allergyDescription: null
    });

    await expect(booking.validate()).rejects.toThrow('Allergy description is required');
  });

  it('rejects an allergy flag with a blank description', async () => {
    const booking = models.Booking.build({
      ...baseAttributes,
      allergyFlag: true,
      allergyDescription: '   '
    });

    await expect(booking.validate()).rejects.toThrow('Allergy description is required');
  });

  it('accepts an allergy flag with a real description', async () => {
    const booking = models.Booking.build({
      ...baseAttributes,
      allergyFlag: true,
      allergyDescription: 'Peanut allergy'
    });

    await booking.validate();
  });

  it('accepts no allergy flag regardless of description', async () => {
    const booking = models.Booking.build({
      ...baseAttributes,
      allergyFlag: false,
      allergyDescription: null
    });

    await booking.validate();
  });
});
