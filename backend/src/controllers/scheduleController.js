/**
 * MH-95 (MH-09 Repeat a weekly schedule): endpoint to copy a weekly schedule.
 *
 * POST /api/slots/copy-week
 * Body: { sourceWeekStart: 'YYYY-MM-DD', targetWeekStarts: ['YYYY-MM-DD', ...] }
 * Every week is identified by its Monday.
 */
import {
  copyWeekSchedule,
  validateWeekStart,
  ScheduleCopyError
} from '../services/scheduleCopyService.js';

/**
 * Today's date as YYYY-MM-DD in the server's local time zone
 * (slot dates and times are local, see bookingService).
 */
function todayLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ScheduleCopyError(400, 'Invalid request body');
  }

  const { sourceWeekStart, targetWeekStarts } = body;

  validateWeekStart(sourceWeekStart, 'sourceWeekStart');

  if (!Array.isArray(targetWeekStarts) || targetWeekStarts.length === 0) {
    throw new ScheduleCopyError(400, 'targetWeekStarts must be a non-empty array of dates');
  }

  const today = todayLocal();
  for (const weekStart of targetWeekStarts) {
    validateWeekStart(weekStart, 'targetWeekStarts');
    // A week that has already started would get slots on past days.
    // The source week may be in the past: copying an old schedule is allowed.
    if (weekStart < today) {
      throw new ScheduleCopyError(400, `Target week starting ${weekStart} is in the past`);
    }
  }

  return { sourceWeekStart, targetWeekStarts };
}

export async function copyWeek(req, res) {
  try {
    const input = validateRequest(req.body);
    const result = await copyWeekSchedule(input);
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof ScheduleCopyError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error copying weekly schedule:', error);
    return res.status(500).json({ error: 'Failed to copy weekly schedule' });
  }
}
