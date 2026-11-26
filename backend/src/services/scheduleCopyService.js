/**
 * MH-94 (MH-09 Repeat a weekly schedule): copy service.
 *
 * In a single transaction, copies a week's slots (with their tables and
 * capacity) to one or more target weeks. A target week that has bookings is
 * rejected; otherwise its existing schedule is fully replaced.
 *
 * Weeks are identified by their first day, which must be a Monday (YYYY-MM-DD).
 */
import { Op, Transaction } from 'sequelize';
import { sequelize, models } from '../db/index.js';

export class ScheduleCopyError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ScheduleCopyError';
    this.status = status;
  }
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BUSY_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 25;

function parseDate(dateStr) {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    return null;
  }
  const date = new Date(`${dateStr}T00:00:00Z`);
  // Rejects dates such as 2030-02-30 that JS would silently roll over
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr) {
    return null;
  }
  return date;
}

/**
 * Adds `days` days to a YYYY-MM-DD date string (UTC arithmetic, DST-safe).
 */
export function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  if (!date) {
    throw new ScheduleCopyError(400, `Invalid date: ${dateStr}`);
  }
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Validates that `value` is a real YYYY-MM-DD date falling on a Monday.
 */
export function validateWeekStart(value, field = 'weekStart') {
  const date = parseDate(value);
  if (!date) {
    throw new ScheduleCopyError(400, `${field} must be a valid date in YYYY-MM-DD format`);
  }
  if (date.getUTCDay() !== 1) {
    throw new ScheduleCopyError(400, `${field} must be a Monday`);
  }
  return value;
}

/**
 * Returns the Monday..Sunday range of the week starting on `weekStart`.
 */
export function getWeekRange(weekStart) {
  return { start: weekStart, end: addDays(weekStart, 6) };
}

function daysBetween(fromDateStr, toDateStr) {
  return Math.round((parseDate(toDateStr) - parseDate(fromDateStr)) / DAY_MS);
}

function isSqliteBusy(error) {
  return (
    error?.original?.code === 'SQLITE_BUSY' ||
    error?.parent?.code === 'SQLITE_BUSY' ||
    error?.code === 'SQLITE_BUSY'
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// IMMEDIATE transaction: no booking can be created on a target week while the copy runs
async function runScheduleTransaction(callback) {
  for (let attempt = 0; attempt <= MAX_BUSY_RETRIES; attempt++) {
    try {
      return await sequelize.transaction(
        { type: Transaction.TYPES.IMMEDIATE },
        callback
      );
    } catch (error) {
      if (!isSqliteBusy(error)) {
        throw error;
      }
      if (attempt === MAX_BUSY_RETRIES) {
        throw new ScheduleCopyError(503, 'Schedule service temporarily busy');
      }
      await delay(BASE_RETRY_DELAY_MS * 2 ** attempt);
    }
  }
}

function validateInput({ sourceWeekStart, targetWeekStarts }) {
  validateWeekStart(sourceWeekStart, 'sourceWeekStart');

  if (!Array.isArray(targetWeekStarts) || targetWeekStarts.length === 0) {
    throw new ScheduleCopyError(400, 'targetWeekStarts must be a non-empty array of dates');
  }

  targetWeekStarts.forEach((week) => validateWeekStart(week, 'targetWeekStarts'));

  if (new Set(targetWeekStarts).size !== targetWeekStarts.length) {
    throw new ScheduleCopyError(400, 'targetWeekStarts must not contain duplicates');
  }
  if (targetWeekStarts.includes(sourceWeekStart)) {
    throw new ScheduleCopyError(400, 'The source week cannot be a target week');
  }
}

function serializeSlot(slot, tableIds) {
  return {
    id: slot.id,
    date: slot.date,
    startTime: slot.startTime,
    duration: slot.duration,
    meal: slot.meal,
    totalCapacity: slot.totalCapacity,
    status: slot.status,
    tableIds
  };
}

/**
 * Copies the schedule of the week starting on `sourceWeekStart` onto every
 * week listed in `targetWeekStarts`. All or nothing: if any target week has
 * bookings, no week is modified.
 *
 * @param {{ sourceWeekStart: string, targetWeekStarts: string[] }} input
 * @returns {Promise<{ sourceWeekStart: string, weeks: Array }>}
 */
export async function copyWeekSchedule({ sourceWeekStart, targetWeekStarts } = {}) {
  validateInput({ sourceWeekStart, targetWeekStarts });

  const { Slot, DiningTable, SlotTable, Booking, Menu } = models;
  const orderedTargets = [...targetWeekStarts].sort();

  return runScheduleTransaction(async (transaction) => {
    const sourceRange = getWeekRange(sourceWeekStart);
    const sourceSlots = await Slot.findAll({
      where: { date: { [Op.between]: [sourceRange.start, sourceRange.end] } },
      include: [{
        model: DiningTable,
        as: 'tables',
        attributes: ['id'],
        through: { attributes: [] }
      }],
      order: [['date', 'ASC'], ['startTime', 'ASC']],
      transaction
    });

    if (sourceSlots.length === 0) {
      throw new ScheduleCopyError(400, 'Source week has no slots to copy');
    }

    // 1. Check every target week before modifying anything
    const targets = [];
    for (const weekStart of orderedTargets) {
      const range = getWeekRange(weekStart);
      const existingSlots = await Slot.findAll({
        where: { date: { [Op.between]: [range.start, range.end] } },
        attributes: ['id'],
        transaction
      });
      const existingIds = existingSlots.map((s) => s.id);

      if (existingIds.length > 0) {
        const bookingCount = await Booking.count({
          where: { slotId: { [Op.in]: existingIds } },
          transaction
        });
        if (bookingCount > 0) {
          throw new ScheduleCopyError(
            409,
            `Target week starting ${weekStart} has bookings and cannot be replaced`
          );
        }
      }

      targets.push({ weekStart, existingIds });
    }

    // 2. Replace each target week with a copy of the source week
    const weeks = [];
    for (const { weekStart, existingIds } of targets) {
      if (existingIds.length > 0) {
        const where = { slotId: { [Op.in]: existingIds } };
        await Menu.destroy({ where, transaction });
        await SlotTable.destroy({ where, transaction });
        await Slot.destroy({ where: { id: { [Op.in]: existingIds } }, transaction });
      }

      const offsetDays = daysBetween(sourceWeekStart, weekStart);
      const createdSlots = [];

      for (const source of sourceSlots) {
        const copy = await Slot.create({
          date: addDays(source.date, offsetDays),
          startTime: source.startTime,
          duration: source.duration,
          meal: source.meal,
          totalCapacity: source.totalCapacity,
          status: source.status
        }, { transaction });

        const tableIds = (source.tables ?? []).map((t) => t.id);
        if (tableIds.length > 0) {
          await SlotTable.bulkCreate(
            tableIds.map((tableId) => ({ slotId: copy.id, tableId })),
            { transaction }
          );
        }

        createdSlots.push(serializeSlot(copy, tableIds));
      }

      weeks.push({ weekStart, replacedSlots: existingIds.length, createdSlots });
    }

    return { sourceWeekStart, weeks };
  });
}
