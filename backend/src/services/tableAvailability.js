import { Op } from 'sequelize';
import { models } from '../db/index.js';

/**
 * Retrieves all available tables for a given time slot,
 * calculating the remaining seats for each table (Table Sharing management - MH-01).
 * 
 * @param {number} slotId - Time slot ID
 * @returns {Promise<Array>} Array of table objects with residual capacity (.seats)
 */
export async function findFreeTables(slotId) {
  const { DiningTable, Slot, Booking } = models;

  // 1. Retrieve all tables associated with the specified slot
  const slotWithTables = await Slot.findByPk(slotId, {
    include: [
      {
        model: DiningTable,
        as: 'tables',
        through: { attributes: [] }
      }
    ]
  });

  if (!slotWithTables || !slotWithTables.tables || slotWithTables.tables.length === 0) {
    return [];
  }

  const slotTables = slotWithTables.tables;

  // 2. Find active bookings (PENDING / CONFIRMED) for this slot
  const activeBookings = await Booking.findAll({
    where: {
      slotId: slotId,
      status: {
        [Op.in]: ['PENDING', 'CONFIRMED']
      }
    },
    include: [
      {
        model: DiningTable,
        as: 'tables',
        attributes: ['id', 'seats'],
        through: { attributes: [] }
      }
    ]
  });

  // 3. Calculate the occupied seats for each table in the slot
  const occupiedSeatsMap = {};

  for (const booking of activeBookings) {
    if (!booking.tables || booking.tables.length === 0) continue;

    let remainingPeople = booking.numberOfPeople;

    // Distributes booking customers on assigned tables
    for (const table of booking.tables) {
      const currentOccupied = occupiedSeatsMap[table.id] || 0;
      const tableCapacity = table.seats;
      const tableRemainingCapacity = Math.max(0, tableCapacity - currentOccupied);

      const seatsTakenByBooking = Math.min(remainingPeople, tableRemainingCapacity);
      occupiedSeatsMap[table.id] = currentOccupied + seatsTakenByBooking;
      remainingPeople -= seatsTakenByBooking;

      if (remainingPeople <= 0) break;
    }
  }

  // 4. Map the slot tables with the remaining capacity (Table Sharing)
  const availableTables = slotTables
    .map(table => {
      const rawTable = table.get({ plain: true });
      const occupiedSeats = occupiedSeatsMap[rawTable.id] || 0;
      const freeSeats = Math.max(0, rawTable.seats - occupiedSeats);

      return {
        id: rawTable.id,
        tableNumber: rawTable.tableNumber,
        totalSeats: rawTable.seats,
        occupiedSeats: occupiedSeats,
        seats: freeSeats,          // Residual free seats (used by partySplit)
        availableSeats: freeSeats
      };
    })
    .filter(table => table.seats > 0); // Consider only tables with at least 1 free seat

  return availableTables;
}