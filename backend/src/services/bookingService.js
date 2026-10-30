import { Op, Transaction } from 'sequelize';
import { sequelize, models } from '../db/index.js';
import { findFreeTables } from './tableAvailability.js';
import { splitParty } from './partySplit.js';

export class BookingError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'BookingError';
    this.status = status;
  }
}

/**
 * Creates a booking and assigns tables to the hiker.
 *
 * @param {Object} data
 * @returns {Promise<Object>} Created booking details
 */
export async function createBookingForHiker({
  hikerId,
  slotId,
  numberOfPeople,
  allergyFlag = false,
  allergyDescription = null
}) {
    const { User, Slot, Booking, BookingTable } = models;

    // Basic input validation
    if (!Number.isSafeInteger(numberOfPeople) || numberOfPeople < 1) {
        throw new BookingError(400, 'Invalid party size');
    }

    if (!Number.isSafeInteger(slotId) || slotId < 1) {
        throw new BookingError(400, 'Invalid slot ID');
    }

    if (typeof allergyFlag !== 'boolean') {
        throw new BookingError(400, 'Invalid allergy flag');
    }

    if (allergyFlag && (typeof allergyDescription !== 'string' || !allergyDescription.trim())) {
        throw new BookingError(400, 'Allergy description is required');
    }

    // All database operations belong to one transaction
    return sequelize.transaction(
        { type: Transaction.TYPES.IMMEDIATE }, async transaction => {

        // 1. Verify the hiker
        const hiker = await User.findByPk(hikerId, {
            transaction
        });

        if (!hiker || hiker.role !== 'HIKER') {
            throw new BookingError(403, 'Invalid hiker');
        }

        // 2. Verify the slot
        const slot = await Slot.findByPk(slotId, {
            transaction
        });

        if (!slot) {
            throw new BookingError(404, 'Slot not found');
        }

        if (slot.status !== 'OPEN') {
            throw new BookingError(409, 'Slot is not available');
        }

        // 3. Verify overall slot capacity
        const bookedSeats = await Booking.sum(
            'numberOfPeople',
            {
            where: {
                slotId,
                status: {
                [Op.in]: ['PENDING', 'CONFIRMED']
                }
            },
            transaction
            }
        );

        const remainingCapacity =
            slot.totalCapacity - (bookedSeats ?? 0);

        if (numberOfPeople > remainingCapacity) {
            throw new BookingError(409, 'Insufficient slot capacity');
        }

        // 4. Retrieve available tables
        const freeTables = await findFreeTables(
            slotId, { transaction }
        );

        // 5. Calculate optimal table allocation
        const allocatedTables = splitParty(
            numberOfPeople, freeTables
        );

        if (!allocatedTables || allocatedTables.length === 0) {
            throw new BookingError(
            409, 'Not enough available table seats'
            );
        }

        const allocatedSeats = allocatedTables.reduce(
            (sum, table) => sum + table.allocatedSeats, 0
        );

        if (allocatedSeats !== numberOfPeople || allocatedTables.some(table => !Number.isSafeInteger(table.allocatedSeats) || table.allocatedSeats < 1)) {
            throw new Error('Invalid table allocation');
        }

        // 6. Create the booking
        const booking = await Booking.create({
            hikerId,
            slotId,
            numberOfPeople,
            status: 'CONFIRMED',
            allergyFlag,
            allergyDescription: allergyFlag
            ? allergyDescription.trim()
            : null
        }, { transaction });

        // 7. Save the allocated seats for each table
        await BookingTable.bulkCreate(
            allocatedTables.map(table => ({
            bookingId: booking.id,
            tableId: table.id,
            allocatedSeats: table.allocatedSeats
            })),
            {
                transaction,
                validate: true
            }
        );

        // 8. Return the created booking
        return {
            id: booking.id,
            hikerId: booking.hikerId,
            slotId: booking.slotId,
            numberOfPeople: booking.numberOfPeople,
            status: booking.status,
            tables: allocatedTables.map(table => ({
            id: table.id,
            tableNumber: table.tableNumber,
            allocatedSeats: table.allocatedSeats
            }))
        };
        }
    );
}
