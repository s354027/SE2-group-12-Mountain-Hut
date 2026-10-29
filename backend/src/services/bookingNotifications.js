import { models } from '../db/index.js';
import { sendBookingConfirmation } from './emailService.js';

function formatDateForEmail(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatTimeForEmail(time) {
  return time.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
}

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = time.split(':').map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  const endHours = String(Math.floor((total % (24 * 60)) / 60)).padStart(2, '0');
  const endMinutes = String(total % 60).padStart(2, '0');
  return `${endHours}:${endMinutes}`;
}

/**
 * Sends the booking confirmation email for an already-saved booking.
 * Meant to be called explicitly by whoever creates the booking (MH-28),
 * once the booking and its assigned tables are both persisted.
 *
 * @param {number} bookingId
 * @returns {Promise<boolean>} true if the email was sent, false if it was skipped (e.g. no email on file)
 */
export async function notifyBookingConfirmed(bookingId) {
  const { Booking, User, Slot } = models;

  const booking = await Booking.findByPk(bookingId, {
    include: [
      { model: User, as: 'hiker' },
      { model: Slot, as: 'slot' }
    ]
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const { hiker, slot } = booking;

  if (!hiker?.email) {
    console.warn(`Booking ${bookingId}: hiker has no email on file, confirmation email skipped`);
    return false;
  }

  const slotStart = formatTimeForEmail(slot.startTime);

  return sendBookingConfirmation(
    hiker.email,
    `${hiker.firstName} ${hiker.lastName}`,
    booking.id,
    formatDateForEmail(slot.date),
    slotStart,
    addMinutesToTime(slotStart, slot.duration),
    booking.numberOfPeople,
    booking.allergyFlag ? booking.allergyDescription : null
  );
}
