import {
  createBookingForHiker,
  createBookingByStaff,
  cancelBooking as cancelBookingService,
  modifyBookingForHiker,
  BookingError,
} from "../services/bookingService.js";

import {
  notifyBookingConfirmed,
  notifyBookingModified,
} from "../services/bookingNotifications.js";

/**
 * Handles HTTP requests to create a booking.
 * Validates input and delegates business logic to bookingService.
 */
export async function createBooking(req, res) {
  const body = req.body;

  // 1. Validate request body
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "Invalid request body",
    });
  }

  const {
    slotId,
    numberOfPeople,
    allergyFlag = false,
    allergyDescription = null,
    dietaryRequirements = [],
  } = body;

  // 2. Validate mandatory fields
  if (!Number.isSafeInteger(slotId) || slotId < 1) {
    return res.status(400).json({
      error: "slotId must be a positive integer",
    });
  }

  if (!Number.isSafeInteger(numberOfPeople) || numberOfPeople < 1) {
    return res.status(400).json({
      error: "numberOfPeople must be a positive integer",
    });
  }

  // 3. Validate allergy information
  if (typeof allergyFlag !== "boolean") {
    return res.status(400).json({
      error: "allergyFlag must be a boolean",
    });
  }

  if (allergyDescription !== null && typeof allergyDescription !== "string") {
    return res.status(400).json({
      error: "Invalid allergyDescription",
    });
  }

  const description = allergyDescription?.trim() || null;

  if (allergyFlag && !description) {
    return res.status(400).json({
      error: "Allergy description is required",
    });
  }

  if (!Array.isArray(dietaryRequirements)) {
    return res.status(400).json({
      error: "dietaryRequirements must be an array",
    });
  }

  if (
    dietaryRequirements.some(
      (requirement) =>
        !requirement ||
        typeof requirement !== "object" ||
        Array.isArray(requirement),
    )
  ) {
    return res.status(400).json({
      error: "Each dietary requirement must be an object",
    });
  }

  if (
    dietaryRequirements.some(
      (requirement) => typeof requirement.allergies !== "boolean",
    )
  ) {
    return res.status(400).json({
      error: "Each dietary requirement must have an allergies boolean",
    });
  }

  if (
    dietaryRequirements.some(
      (requirement) =>
        typeof requirement.description !== "string" ||
        !requirement.description.trim(),
    )
  ) {
    return res.status(400).json({
      error: "Each dietary requirement must have a non-empty description",
    });
  }

  try {
    // 4. Create booking using authenticated user ID
    const booking = await createBookingForHiker({
      hikerId: req.session.user.id,
      slotId,
      numberOfPeople,
      allergyFlag,
      allergyDescription: allergyFlag ? description : null,
      dietaryRequirements,
    });

    // 5. Send confirmation after successful commit
    try {
      await notifyBookingConfirmed(booking.id);
    } catch (error) {
      console.error("Booking notification failed:", error);
    }

    // 6. Return created booking
    return res.status(201).json(booking);
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        error: "Invalid booking data",
      });
    }

    console.error("Booking creation failed:", error);

    return res.status(500).json({
      error: "Unable to create booking",
    });
  }
}

export async function cancelBooking(req, res) {
  const bookingId = Number(req.params.bookingId ?? req.params.id);

  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    return res.status(400).json({
      error: "bookingId must be a positive integer",
    });
  }

  try {
    const booking = await cancelBookingService({
      bookingId,
      hikerId:
        req.session.user.role === "HIKER" ? req.session.user.id : undefined,
    });

    return res.status(200).json(booking);
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    console.error("Booking cancellation failed:", error);

    return res.status(500).json({
      error: "Unable to cancel booking",
    });
  }
}

export async function modifyBooking(req, res) {
  const bookingId = Number(req.params.id);
  const body = req.body;

  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    return res
      .status(400)
      .json({ error: "bookingId must be a positive integer" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const allowedFields = [
    "slotId",
    "numberOfPeople",
    "allergyFlag",
    "allergyDescription",
    "dietaryRequirements",
  ];

  const bodyFields = Object.keys(body);

  if (bodyFields.length === 0) {
    return res.status(400).json({ error: "No booking fields to update" });
  }
  if (bodyFields.some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ error: "Unsupported booking field" });
  }

  try {
    const booking = await modifyBookingForHiker({
      bookingId,
      hikerId: req.session.user.id,
      slotId: body.slotId,
      numberOfPeople: body.numberOfPeople,
      allergyFlag: body.allergyFlag,
      allergyDescription: body.allergyDescription,
      dietaryRequirements: body.dietaryRequirements,
    });

    // Send the updated reservation details after the change commits.
    try {
      await notifyBookingModified(booking.id);
    } catch (error) {
      console.error("Booking modification notification failed:", error);
    }

    return res.status(200).json(booking);
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({
        error: error.message,
      });
    }
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({ error: "Invalid booking data" });
    }
    console.error("Booking modification failed:", error);
    return res.status(500).json({ error: "Unable to modify booking" });
  }
}

const HIKER_MODES = ["EXISTING", "FULL", "QUICK"];

/**
 * Handles HTTP requests from an employee entering a reservation
 * on behalf of a hiker (MH-07), e.g. received by phone or in person.
 *
 * Body:
 * {
 *   hiker: { mode: 'EXISTING', id }
 *        | { mode: 'FULL', firstName, lastName, email, phone, notes?, emergencyContact? }
 *        | { mode: 'QUICK', firstName, lastName?, phone? },
 *   slotId, numberOfPeople, allergyFlag?, allergyDescription?, dietaryRequirements?
 * }
 */
export async function createStaffBooking(req, res) {
  const body = req.body;

  // 1. Validate request body
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({
      error: "Invalid request body",
    });
  }

  const {
    hiker,
    slotId,
    numberOfPeople,
    allergyFlag = false,
    allergyDescription = null,
    dietaryRequirements = [],
  } = body;

  // 2. Validate hiker information
  if (!hiker || typeof hiker !== "object" || Array.isArray(hiker)) {
    return res.status(400).json({
      error: "Hiker information is required",
    });
  }

  if (!HIKER_MODES.includes(hiker.mode)) {
    return res.status(400).json({
      error: "Hiker mode must be EXISTING, FULL or QUICK",
    });
  }

  // 3. Validate mandatory booking fields
  if (!Number.isSafeInteger(slotId) || slotId < 1) {
    return res.status(400).json({
      error: "slotId must be a positive integer",
    });
  }

  if (!Number.isSafeInteger(numberOfPeople) || numberOfPeople < 1) {
    return res.status(400).json({
      error: "numberOfPeople must be a positive integer",
    });
  }

  if (typeof allergyFlag !== "boolean") {
    return res.status(400).json({
      error: "allergyFlag must be a boolean",
    });
  }

  if (allergyDescription !== null && typeof allergyDescription !== "string") {
    return res.status(400).json({
      error: "Invalid allergyDescription",
    });
  }

  const description = allergyDescription?.trim() || null;

  if (allergyFlag && !description) {
    return res.status(400).json({
      error: "Allergy description is required",
    });
  }

  if (!Array.isArray(dietaryRequirements)) {
    return res.status(400).json({
      error: "dietaryRequirements must be an array",
    });
  }

  try {
    // 4. Create (or find) the hiker and the booking in one transaction
    const result = await createBookingByStaff({
      hiker,
      slotId,
      numberOfPeople,
      allergyFlag,
      allergyDescription: allergyFlag ? description : null,
      dietaryRequirements,
    });

    // 5. Send confirmation after successful commit
    // (skipped automatically for hikers without an email, e.g. temporary ones)
    try {
      await notifyBookingConfirmed(result.booking.id);
    } catch (error) {
      console.error("Booking notification failed:", error);
    }

    // 6. Return the booking, the hiker and, for a newly created
    // full account, the generated password to communicate to the hiker
    return res.status(201).json({
      ...result.booking,
      hiker: result.hiker,
      ...(result.generatedPassword
        ? { generatedPassword: result.generatedPassword }
        : {}),
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        error: "Invalid booking data",
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "A user with this email is already registered",
      });
    }

    console.error("Staff booking creation failed:", error);

    return res.status(500).json({
      error: "Unable to create booking",
    });
  }
}
