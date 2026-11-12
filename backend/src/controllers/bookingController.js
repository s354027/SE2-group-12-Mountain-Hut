import {createBookingForHiker, cancelBooking as cancelBookingService, BookingError} from '../services/bookingService.js';

import {notifyBookingConfirmed} from '../services/bookingNotifications.js';

/**
 * Handles HTTP requests to create a booking.
 * Validates input and delegates business logic to bookingService.
 */
export async function createBooking(req, res) {
  const body = req.body;

  // 1. Validate request body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: 'Invalid request body'
    });
  }

  const {
    slotId,
    numberOfPeople,
    allergyFlag = false,
    allergyDescription = null,
    dietaryRequirements = []
  } = body;

  // 2. Validate mandatory fields
  if (!Number.isSafeInteger(slotId) || slotId < 1) {
    return res.status(400).json({
      error: 'slotId must be a positive integer'
    });
  }

  if (!Number.isSafeInteger(numberOfPeople) || numberOfPeople < 1) {
    return res.status(400).json({
      error: 'numberOfPeople must be a positive integer'
    });
  }

  // 3. Validate allergy information
  if (typeof allergyFlag !== 'boolean') {
    return res.status(400).json({
      error: 'allergyFlag must be a boolean'
    });
  }

  if (allergyDescription !== null && typeof allergyDescription !== 'string') {
    return res.status(400).json({
      error: 'Invalid allergyDescription'
    });
  }

  const description = allergyDescription?.trim() || null;

  if (allergyFlag && !description) {
    return res.status(400).json({
      error: 'Allergy description is required'
    });
  }

  if (!Array.isArray(dietaryRequirements)) {
    return res.status(400).json({
      error: 'dietaryRequirements must be an array'
    });
  }

  if (dietaryRequirements.some(
    requirement => !requirement || typeof requirement !== 'object' || Array.isArray(requirement)
  )) {
    return res.status(400).json({
      error: 'Each dietary requirement must be an object'
    });
  }

  if (dietaryRequirements.some(
    requirement => typeof requirement.allergies !== 'boolean'
  )) {
    return res.status(400).json({
      error: 'Each dietary requirement must have an allergies boolean'
    });
  }

  if (dietaryRequirements.some(
    requirement => typeof requirement.description !== 'string' || !requirement.description.trim()
  )) {
    return res.status(400).json({
      error: 'Each dietary requirement must have a non-empty description'
    });
  }

  try {
    // 4. Create booking using authenticated user ID
    const booking = await createBookingForHiker({
      hikerId: req.session.user.id,
      slotId,
      numberOfPeople,
      allergyFlag,
      allergyDescription: allergyFlag
        ? description
        : null,
      dietaryRequirements
    });

    // 5. Send confirmation after successful commit
    try {
      await notifyBookingConfirmed(booking.id);
    } catch (error) {
      console.error(
        'Booking notification failed:',
        error
      );
    }

    // 6. Return created booking
    return res.status(201).json(booking);

  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({
        error: error.message
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Invalid booking data'
      });
    }

    console.error('Booking creation failed:', error);

    return res.status(500).json({
      error: 'Unable to create booking'
    });
  }
}

export async function cancelBooking(req, res) {
  const bookingId = Number(req.params.id);

  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    return res.status(400).json({
      error: 'bookingId must be a positive integer'
    });
  }

  try {
    const booking = await cancelBookingService({
      bookingId
    });

    return res.status(200).json(booking);

  } 
  catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({
        error: error.message
      });
    }

    console.error('Booking cancellation failed:', error);

    return res.status(500).json({
      error: 'Unable to cancel booking'
    });
  }
}