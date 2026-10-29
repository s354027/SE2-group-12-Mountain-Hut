import { allocateTables } from '../services/allocation.js';

function normalizeStartTime(startTime) {
  return /^\d{2}:\d{2}$/.test(startTime) ? `${startTime}:00` : startTime;
}

export async function getAvailability(req, res) {
  const { date, startTime, partySize } = req.query;

  if (!date || !startTime) {
    return res.status(400).json({ error: 'date and startTime are required' });
  }

  const numPartySize = Number(partySize);
  if (!Number.isInteger(numPartySize) || numPartySize < 1) {
    return res.status(400).json({ error: 'partySize must be a positive integer' });
  }

  try {
    const result = await allocateTables(date, normalizeStartTime(startTime), numPartySize);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unexpected error while checking availability' });
  }
}
