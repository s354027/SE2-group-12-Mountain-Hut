import { Op } from 'sequelize';
import { models } from '../db/index.js';

/**
 * Retrieve all available tables for a given time slot.
 * A table is occupied when linked to a PENDING or CONFIRMED reservation for the same slotId.
 * 
 * @param {number} slotId - Time slot ID
 * @returns {Promise<Array>} Available DiningTable instance arrays
 */
export async function findFreeTables(slotId) {
  const { DiningTable, Slot, Booking } = models;

  // 1. Find active reservations (PENDING / CONFIRMED) for this specific slotId
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
        attributes: ['id'],
        through: { attributes: [] }
      }
    ]
  });

  // Extract the IDs of all currently occupied tables in this slot
  const occupiedTableIds = activeBookings.flatMap(booking =>
    booking.tables ? booking.tables.map(t => t.id) : []
  );

  // 2. Retrieve all tables configured for the slot excluding occupied ones
  const freeTables = await DiningTable.findAll({
    include: [
      {
        model: Slot,
        as: 'slots',
        where: { id: slotId },
        attributes: [],
        through: { attributes: [] },
        required: true
      }
    ],
    where: occupiedTableIds.length > 0 ? {
      id: {
        [Op.notIn]: occupiedTableIds
      }
    } : {}
  });

  return freeTables;
}