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

/* in order to avoid concurrent bookings: */
const MAX_BUSY_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 25;

function isSqliteBusy(error) {
    return (
        error?.original?.code === 'SQLITE_BUSY' ||
        error?.parent?.code === 'SQLITE_BUSY' ||
        error?.code === 'SQLITE_BUSY'
    );
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms)); // wait a delay before you can retry to book a table
}

async function runBookingTransaction(callback) {
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
                throw new BookingError(
                    503,
                    'Booking service temporarily busy'
                );
            }

            const delayMs =
                BASE_RETRY_DELAY_MS * (2 ** attempt);

            await delay(delayMs);
        }
    }
}


export async function createBookingForHiker({
  hikerId,
  slotId,
  numberOfPeople,
  allergyFlag = false,
  allergyDescription = null,
  dietaryRequirements = []
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

    if (!Array.isArray(dietaryRequirements)) {
        throw new BookingError(400, 'dietaryRequirements must be an array');
    }

    const cleanedDietaryRequirements = dietaryRequirements.map(
        requirement => (typeof requirement === 'string' ? requirement.trim() : '')
    );

    if (cleanedDietaryRequirements.some(requirement => !requirement)) {
        throw new BookingError(400, 'Each dietary requirement must be a non-empty string');
    }

    // All database operations belong to one transaction
    return runBookingTransaction(
        async transaction => {

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

            // 3. Verify booking deadline:
            // hikers can book only until 2 hours before the slot starts

            const slotStart = new Date(`${slot.date}T${slot.startTime}`);
            const twoHoursMs = 2 * 60 * 60 * 1000;

            if (Number.isNaN(slotStart.getTime()) || slotStart.getTime() - Date.now() < twoHoursMs) {
                throw new BookingError(
                    409,
                    'Booking deadline has passed'
                );
            }

            // 4. Verify that the hiker does not already have an active booking for this slot
            const existingBooking = await Booking.findOne({
                where: {
                    hikerId,
                    slotId,
                    status: {
                        [Op.in]: ['PENDING', 'CONFIRMED']
                    }
                },
                transaction
            });

            if (existingBooking) {
                throw new BookingError(
                    409,
                    'Hiker already has a booking for this slot'
                );
            }

            // 5. Verify overall slot capacity
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

            const remainingCapacity = slot.totalCapacity - (bookedSeats ?? 0);

            if (numberOfPeople > remainingCapacity) {
                throw new BookingError(409, 'Insufficient slot capacity');
            }

            // 6. Retrieve available tables
            const freeTables = await findFreeTables(slotId, { transaction });

            // 7. Calculate optimal table allocation
            const allocatedTables = splitParty(numberOfPeople, freeTables);

            if (!allocatedTables || allocatedTables.length === 0) {
                throw new BookingError(
                409, 'Not enough available table seats'
                );
            }

            const allocatedSeats = allocatedTables.reduce((sum, table) => sum + table.allocatedSeats, 0);

            if (allocatedSeats !== numberOfPeople || allocatedTables.some(table => !Number.isSafeInteger(table.allocatedSeats) || table.allocatedSeats < 1)) {
                throw new Error('Invalid table allocation');
            }

            // 8. Create the booking
            const booking = await Booking.create({
                hikerId,
                slotId,
                numberOfPeople,
                status: 'CONFIRMED',
                allergyFlag,
                allergyDescription: allergyFlag ? allergyDescription.trim() : null,
                dietaryRequirements: cleanedDietaryRequirements
            }, { transaction });

            // 9. Save the allocated seats for each table
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

            // 10. Return the created booking
            return {
                id: booking.id,
                hikerId: booking.hikerId,
                slotId: booking.slotId,
                numberOfPeople: booking.numberOfPeople,
                status: booking.status,
                dietaryRequirements: booking.dietaryRequirements,
                tables: allocatedTables.map(table => ({
                    id: table.id,
                    tableNumber: table.tableNumber,
                    allocatedSeats: table.allocatedSeats
                }))
            };
        }
    );
}
