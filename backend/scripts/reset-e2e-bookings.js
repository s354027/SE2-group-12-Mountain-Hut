// Always operate on the dedicated E2E database.
process.env.DB_PATH = "data/e2e.sqlite";

const { sequelize, models } = await import("../src/db/index.js");

try {
    await sequelize.authenticate();

    // Delete child rows first because of the foreign key to Booking.
    await models.BookingTable.destroy({
        where: {},
    });

    await models.Booking.destroy({
        where: {},
    });

    console.log("E2E bookings reset.");
} finally {
    await sequelize.close();  
}