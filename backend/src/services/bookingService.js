import { Op, Transaction } from 'sequelize';
import { sequelize, models } from '../db/index.js';
import { findFreeTables } from './tableAvailability.js';
import { splitParty } from './partySplit.js';
import { generateRandomPassword, generateResetToken, hashPassword } from './authService.js';

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


const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the booking details shared by every booking flow
 * (party size, slot, allergy flag and MH-05 party requirements).
 *
 * @returns {Array<{allergies: boolean, description: string}>} cleaned requirements
 */
function validateBookingDetails({
    slotId,
    numberOfPeople,
    allergyFlag,
    allergyDescription,
    dietaryRequirements
}) {
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

    if (dietaryRequirements.some(
        requirement => !requirement || typeof requirement !== 'object' || Array.isArray(requirement)
    )) {
        throw new BookingError(400, 'Each dietary requirement must be an object');
    }

    if (dietaryRequirements.some(
        requirement => typeof requirement.allergies !== 'boolean'
    )) {
        throw new BookingError(400, 'Each dietary requirement must have an allergies boolean');
    }

    if (dietaryRequirements.some(
        requirement => typeof requirement.description !== 'string' || !requirement.description.trim()
    )) {
        throw new BookingError(400, 'Each dietary requirement must have a non-empty description');
    }

    return dietaryRequirements.map(
        requirement => ({
            allergies: requirement.allergies,
            description: requirement.description.trim()
        })
    );
}

/**
 * Loads the slot and checks that it can be booked.
 */
async function findOpenSlot(slotId, transaction) {
    const { Slot } = models;

    const slot = await Slot.findByPk(slotId, { transaction });

    if (!slot) {
        throw new BookingError(404, 'Slot not found');
    }

    if (slot.status !== 'OPEN') {
        throw new BookingError(409, 'Slot is not available');
    }

    return slot;
}

function getSlotStart(slot) {
    return new Date(`${slot.date}T${slot.startTime}`);
}

/**
 * Applies the MH-01 rules (one booking per slot, capacity, table assignment)
 * and saves the booking with its allocated seats.
 * Must run inside a booking transaction.
 */
async function allocateAndCreateBooking(transaction, {
    hikerId,
    slot,
    numberOfPeople,
    allergyFlag,
    allergyDescription,
    dietaryRequirements
}) {
    const { Booking, BookingTable } = models;
    const slotId = slot.id;

    // 1. Verify that the hiker does not already have an active booking for this slot
    const existingBooking = await Booking.findOne({
        where: {
            hikerId,
            slotId,
            status: {
                [Op.in]: ACTIVE_STATUSES
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

    // 2. Verify overall slot capacity
    const bookedSeats = await Booking.sum(
        'numberOfPeople',
        {
            where: {
                slotId,
                status: {
                    [Op.in]: ACTIVE_STATUSES
                }
            },
            transaction
        }
    );

    const remainingCapacity = slot.totalCapacity - (bookedSeats ?? 0);

    if (numberOfPeople > remainingCapacity) {
        throw new BookingError(409, 'Insufficient slot capacity');
    }

    // 3. Retrieve available tables
    const freeTables = await findFreeTables(slotId, { transaction });

    // 4. Calculate optimal table allocation
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

    // 5. Create the booking
    const booking = await Booking.create({
        hikerId,
        slotId,
        numberOfPeople,
        status: 'CONFIRMED',
        allergyFlag,
        allergyDescription: allergyFlag ? allergyDescription.trim() : null,
        dietaryRequirements
    }, { transaction });

    // 6. Save the allocated seats for each table
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

    // 7. Return the created booking
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

export async function createBookingForHiker({
  hikerId,
  slotId,
  numberOfPeople,
  allergyFlag = false,
  allergyDescription = null,
  dietaryRequirements = []
}) {
    const { User } = models;

    // Basic input validation
    const cleanedDietaryRequirements = validateBookingDetails({
        slotId,
        numberOfPeople,
        allergyFlag,
        allergyDescription,
        dietaryRequirements
    });

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
            const slot = await findOpenSlot(slotId, transaction);

            // 3. Verify booking deadline:
            // hikers can book only until 2 hours before the slot starts
            const slotStart = getSlotStart(slot);
            const twoHoursMs = 2 * 60 * 60 * 1000;

            if (Number.isNaN(slotStart.getTime()) || slotStart.getTime() - Date.now() < twoHoursMs) {
                throw new BookingError(
                    409,
                    'Booking deadline has passed'
                );
            }

            // 4. Capacity check, table assignment and creation (MH-01 rules)
            return allocateAndCreateBooking(transaction, {
                hikerId,
                slot,
                numberOfPeople,
                allergyFlag,
                allergyDescription,
                dietaryRequirements: cleanedDietaryRequirements
            });
        }
    );
}

function optionalTrimmedString(value, fieldName) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        throw new BookingError(400, `${fieldName} must be a string`);
    }

    return value.trim() || null;
}

function requiredTrimmedString(value, fieldName) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new BookingError(400, `${fieldName} is required`);
    }

    return value.trim();
}

/**
 * Validates the hiker part of a staff booking request (MH-07).
 *
 * Supported modes:
 * - EXISTING: { mode, id } hiker already registered in the system
 * - FULL:     { mode, firstName, lastName, email, phone, notes?, emergencyContact? }
 *             creates a regular hiker profile with a random password
 * - QUICK:    { mode, firstName, lastName?, phone? }
 *             creates a temporary hiker that cannot log in
 */
function validateStaffHiker(hiker) {
    if (!hiker || typeof hiker !== 'object' || Array.isArray(hiker)) {
        throw new BookingError(400, 'Hiker information is required');
    }

    switch (hiker.mode) {
        case 'EXISTING': {
            if (!Number.isSafeInteger(hiker.id) || hiker.id < 1) {
                throw new BookingError(400, 'Invalid hiker ID');
            }
            return { mode: 'EXISTING', id: hiker.id };
        }

        case 'FULL': {
            const email = requiredTrimmedString(hiker.email, 'Email').toLowerCase();

            if (!EMAIL_REGEX.test(email)) {
                throw new BookingError(400, 'Invalid email format');
            }

            return {
                mode: 'FULL',
                firstName: requiredTrimmedString(hiker.firstName, 'First name'),
                lastName: requiredTrimmedString(hiker.lastName, 'Last name'),
                email,
                phone: requiredTrimmedString(hiker.phone, 'Mobile number'),
                notes: optionalTrimmedString(hiker.notes, 'Notes'),
                emergencyContact: optionalTrimmedString(hiker.emergencyContact, 'Emergency contact')
            };
        }

        case 'QUICK': {
            return {
                mode: 'QUICK',
                firstName: requiredTrimmedString(hiker.firstName, 'Name'),
                lastName: optionalTrimmedString(hiker.lastName, 'Last name') ?? '',
                phone: optionalTrimmedString(hiker.phone, 'Phone')
            };
        }

        default:
            throw new BookingError(400, 'Hiker mode must be EXISTING, FULL or QUICK');
    }
}

/**
 * Finds or creates the hiker of a staff booking, inside the booking
 * transaction so that a refused booking never leaves an orphan profile.
 */
async function resolveStaffHiker(hikerData, transaction) {
    const { User } = models;

    if (hikerData.mode === 'EXISTING') {
        const hiker = await User.findByPk(hikerData.id, { transaction });

        if (!hiker || hiker.role !== 'HIKER') {
            throw new BookingError(404, 'Hiker not found');
        }

        return { hiker, generatedPassword: null };
    }

    if (hikerData.mode === 'FULL') {
        const existingUser = await User.findOne({
            where: { email: hikerData.email },
            transaction
        });

        if (existingUser) {
            throw new BookingError(409, 'A user with this email is already registered');
        }

        // Random password communicated to the hiker (e.g. verbally),
        // to be changed at the next login
        const generatedPassword = generateRandomPassword();

        const hiker = await User.create({
            firstName: hikerData.firstName,
            lastName: hikerData.lastName,
            email: hikerData.email,
            phone: hikerData.phone,
            notes: hikerData.notes,
            emergencyContact: hikerData.emergencyContact,
            passwordHash: await hashPassword(generatedPassword),
            mustChangePassword: true,
            isTemporary: false,
            role: 'HIKER'
        }, { transaction });

        return { hiker, generatedPassword };
    }

    // QUICK: temporary hiker, not entitled to log in.
    // The password hash is derived from a random value nobody knows.
    const hiker = await User.create({
        firstName: hikerData.firstName,
        lastName: hikerData.lastName,
        email: null,
        phone: hikerData.phone,
        passwordHash: await hashPassword(generateResetToken()),
        isTemporary: true,
        mustChangePassword: false,
        role: 'HIKER'
    }, { transaction });

    return { hiker, generatedPassword: null };
}

/**
 * Creates a booking entered by an employee on behalf of a hiker (MH-07),
 * e.g. for reservations received by phone, message or in person.
 *
 * The only time constraint is that the booking cannot be made after
 * the beginning of the time slot. All MH-01 rules still apply.
 *
 * @returns {Promise<{booking: Object, hiker: Object, generatedPassword: string|null}>}
 */
export async function createBookingByStaff({
    hiker,
    slotId,
    numberOfPeople,
    allergyFlag = false,
    allergyDescription = null,
    dietaryRequirements = []
}) {
    const hikerData = validateStaffHiker(hiker);

    const cleanedDietaryRequirements = validateBookingDetails({
        slotId,
        numberOfPeople,
        allergyFlag,
        allergyDescription,
        dietaryRequirements
    });

    return runBookingTransaction(
        async transaction => {

            // 1. Verify the slot
            const slot = await findOpenSlot(slotId, transaction);

            // 2. Employee-made reservations cannot be made
            // after the beginning of the time slot
            const slotStart = getSlotStart(slot);

            if (Number.isNaN(slotStart.getTime()) || Date.now() >= slotStart.getTime()) {
                throw new BookingError(409, 'Slot has already started');
            }

            // 3. Find or create the hiker
            const { hiker: bookingHiker, generatedPassword } =
                await resolveStaffHiker(hikerData, transaction);

            // 4. Capacity check, table assignment and creation (MH-01 rules)
            const booking = await allocateAndCreateBooking(transaction, {
                hikerId: bookingHiker.id,
                slot,
                numberOfPeople,
                allergyFlag,
                allergyDescription,
                dietaryRequirements: cleanedDietaryRequirements
            });

            return {
                booking,
                hiker: {
                    id: bookingHiker.id,
                    firstName: bookingHiker.firstName,
                    lastName: bookingHiker.lastName,
                    email: bookingHiker.email,
                    phone: bookingHiker.phone,
                    isTemporary: bookingHiker.isTemporary
                },
                generatedPassword
            };
        }
    );
}

export async function cancelBooking({bookingId}) {
  const { Booking } = models;

  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    throw new BookingError(400, 'Invalid booking ID');
  }

  const booking = await Booking.findByPk(bookingId);

  if (!booking) {
    throw new BookingError(404, 'Booking not found');
  }

  if (!ACTIVE_STATUSES.includes(booking.status)) { // can be cancelled only if it is pending or confirmed
    throw new BookingError(
      409,
      'Booking is not active'
    );
  }

  await booking.update({status: 'CANCELLED'});

  return {
    id: booking.id,
    hikerId: booking.hikerId,
    slotId: booking.slotId,
    numberOfPeople: booking.numberOfPeople,
    status: booking.status
  };
}

// Only the modified booking is reallocated; existing bookings keep their current table assignments.
export async function modifyBookingForHiker({
    bookingId,
    hikerId,
    slotId,
    numberOfPeople,
    allergyFlag,
    allergyDescription,
    dietaryRequirements
}) {
    const { Booking, BookingTable, DiningTable } = models;

    if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
        throw new BookingError(400, 'Invalid booking ID');
    }

    return runBookingTransaction(async transaction => {

        // 1. Load the booking
        const booking = await Booking.findByPk(
            bookingId,
            { transaction }
        );

        if (!booking) {
            throw new BookingError(404, 'Booking not found');
        }

        // 2. A hiker can modify only their own booking
        if (booking.hikerId !== hikerId) {
            throw new BookingError(403, 'Cannot modify another hiker booking');
        }

        if (!ACTIVE_STATUSES.includes(booking.status)) {
            throw new BookingError(409, 'Booking is not active');
        }

        // PATCH semantics: omitted fields keep their current value.
        const finalSlotId = slotId === undefined ? booking.slotId : slotId;

        const finalNumberOfPeople = numberOfPeople === undefined ? booking.numberOfPeople : numberOfPeople;

        const finalAllergyFlag = allergyFlag === undefined ? booking.allergyFlag : allergyFlag;

        const finalAllergyDescription = allergyDescription === undefined ? booking.allergyDescription : allergyDescription;

        const finalDietaryRequirements = dietaryRequirements === undefined ? booking.dietaryRequirements : dietaryRequirements;

        // 3. Validate the final state of the booking
        const cleanedDietaryRequirements = validateBookingDetails({
            slotId: finalSlotId,
            numberOfPeople: finalNumberOfPeople,
            allergyFlag: finalAllergyFlag,
            allergyDescription: finalAllergyDescription,
            dietaryRequirements: finalDietaryRequirements
        });

        const allocationChanged = finalSlotId !== booking.slotId || finalNumberOfPeople !== booking.numberOfPeople;

        /*
         * If only requirements changed, don't touch the
         * table allocation.
         */
        if (allocationChanged) {
            // 4. Verify the target slot
            const slot = await findOpenSlot(
                finalSlotId,
                transaction
            );

            // Moving/changing the reservation must still
            // respect the hiker booking deadline.
            const slotStart = getSlotStart(slot);
            const twoHoursMs = 2 * 60 * 60 * 1000;

            if (Number.isNaN(slotStart.getTime()) || slotStart.getTime() - Date.now() < twoHoursMs) {
                throw new BookingError(409, 'Booking deadline has passed');
            }

            // 5. The hiker cannot end up with two active
            // bookings for the same slot.
            const existingBooking = await Booking.findOne({
                where: {
                    id: {
                        [Op.ne]: booking.id
                    },
                    hikerId,
                    slotId: finalSlotId,
                    status: {
                        [Op.in]: ACTIVE_STATUSES
                    }
                },
                transaction
            });

            if (existingBooking) {
                throw new BookingError(409, 'Hiker already has a booking for this slot');
            }

            // 6. Check slot capacity, ignoring the booking
            // currently being modified.
            const bookedSeats = await Booking.sum(
                'numberOfPeople',
                {
                    where: {
                        id: {
                            [Op.ne]: booking.id
                        },
                        slotId: finalSlotId,
                        status: {
                            [Op.in]: ACTIVE_STATUSES
                        }
                    },
                    transaction
                }
            );

            const remainingCapacity =
                slot.totalCapacity -
                (bookedSeats ?? 0);

            if (
                finalNumberOfPeople >
                remainingCapacity
            ) {
                throw new BookingError(
                    409,
                    'Insufficient slot capacity'
                );
            }

            // 7. Find free tables while ignoring the old
            // allocation of this booking.
            const freeTables = await findFreeTables(
                    finalSlotId,
                    {
                        transaction,
                        excludeBookingId: booking.id
                    }
                );

            const allocatedTables =
                splitParty(
                    finalNumberOfPeople,
                    freeTables
                );

            if (
                !allocatedTables || allocatedTables.length === 0
            ) {
                throw new BookingError(409, 'Not enough available table seats');
            }

            const allocatedSeats = allocatedTables.reduce((sum, table) => sum + table.allocatedSeats, 0);

            if (allocatedSeats !== finalNumberOfPeople || allocatedTables.some(table => !Number.isSafeInteger(table.allocatedSeats) || table.allocatedSeats < 1)) {
                throw new Error('Invalid table allocation');
            }

            // 8. Remove the old allocation.
            await BookingTable.destroy({
                where: {
                    bookingId: booking.id
                },
                transaction
            });

            // 9. Save the new allocation.
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
        }

        // 10. Update booking data
        await booking.update(
            {
                slotId: finalSlotId,
                numberOfPeople: finalNumberOfPeople,
                allergyFlag: finalAllergyFlag,
                allergyDescription: finalAllergyFlag ? finalAllergyDescription.trim() : null,
                dietaryRequirements: cleanedDietaryRequirements
            },
            { transaction }
        );

        // 11. Reload the final table assignment
        const updatedBooking =
            await Booking.findByPk(
                booking.id,
                {
                    include: [
                        {
                            model: DiningTable,
                            as: 'tables',
                            through: {
                                attributes: ['allocatedSeats']
                            }
                        }
                    ],
                    transaction
                }
            );

        return {
            id: updatedBooking.id,
            hikerId: updatedBooking.hikerId,
            slotId: updatedBooking.slotId,
            numberOfPeople: updatedBooking.numberOfPeople,
            status: updatedBooking.status,
            allergyFlag: updatedBooking.allergyFlag,
            allergyDescription: updatedBooking.allergyDescription,
            dietaryRequirements: updatedBooking.dietaryRequirements,

            tables: updatedBooking.tables.map(
                table => ({
                    id: table.id,
                    tableNumber: table.tableNumber,
                    allocatedSeats: table.BookingTable.allocatedSeats
                })
            )
        };
    });
}

function formatBookingWithSlot(booking) {
    return {
        id: booking.id,
        hikerId: booking.hikerId,
        slotId: booking.slotId,
        numberOfPeople: booking.numberOfPeople,
        status: booking.status,
        allergyFlag: booking.allergyFlag,
        allergyDescription: booking.allergyDescription,
        dietaryRequirements: booking.dietaryRequirements,

        slot: booking.slot && {
            id: booking.slot.id,
            date: booking.slot.date,
            startTime: booking.slot.startTime,
            duration: booking.slot.duration,
            meal: booking.slot.meal
        },

        tables: booking.tables.map(
            table => ({
                id: table.id,
                tableNumber: table.tableNumber,
                allocatedSeats: table.BookingTable.allocatedSeats
            })
        )
    };
}

/**
 * Loads a single booking owned by the given hiker, including its
 * slot and table allocation, so the frontend can prefill an edit form.
 */
export async function getBookingForHiker({ bookingId, hikerId }) {
    const { Booking, Slot, DiningTable } = models;

    if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
        throw new BookingError(400, 'Invalid booking ID');
    }

    const booking = await Booking.findByPk(bookingId, {
        include: [
            {
                model: Slot,
                as: 'slot',
                attributes: ['id', 'date', 'startTime', 'duration', 'meal']
            },
            {
                model: DiningTable,
                as: 'tables',
                through: { attributes: ['allocatedSeats'] }
            }
        ]
    });

    if (!booking) {
        throw new BookingError(404, 'Booking not found');
    }

    if (booking.hikerId !== hikerId) {
        throw new BookingError(403, 'Cannot view another hiker booking');
    }

    return formatBookingWithSlot(booking);
}

/**
 * Lists every booking owned by the given hiker (most recent slot first),
 * for a "my bookings" overview.
 */
export async function listBookingsForHiker({ hikerId }) {
    const { Booking, Slot, DiningTable } = models;

    const bookings = await Booking.findAll({
        where: { hikerId },
        include: [
            {
                model: Slot,
                as: 'slot',
                attributes: ['id', 'date', 'startTime', 'duration', 'meal']
            },
            {
                model: DiningTable,
                as: 'tables',
                through: { attributes: ['allocatedSeats'] }
            }
        ],
        order: [
            [{ model: Slot, as: 'slot' }, 'date', 'DESC'],
            [{ model: Slot, as: 'slot' }, 'startTime', 'DESC']
        ]
    });

    return bookings.map(formatBookingWithSlot);
}