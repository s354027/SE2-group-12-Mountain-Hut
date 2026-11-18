// Read-only helper used by the E2E tests to verify what was persisted.
// Usage: node scripts/get-e2e-booking.js <bookingId>
// Prints the booking as JSON on stdout (or "null" if it does not exist).

// Always operate on the dedicated E2E database.
process.env.DB_PATH = "data/e2e.sqlite";

const { sequelize, models } = await import("../src/db/index.js");

const bookingId = Number(process.argv[2]);

if (!Number.isInteger(bookingId) || bookingId <= 0) {
    console.error("Usage: node scripts/get-e2e-booking.js <bookingId>");
    process.exit(1);
}

try {
    await sequelize.authenticate();

    const booking = await models.Booking.findByPk(bookingId);

    const result = booking
        ? {
            id: booking.id,
            hikerId: booking.hikerId,
            slotId: booking.slotId,
            numberOfPeople: booking.numberOfPeople,
            status: booking.status,
            dietaryRequirements: booking.dietaryRequirements,
        }
        : null;

    process.stdout.write(JSON.stringify(result));
} finally {
    await sequelize.close();
}
