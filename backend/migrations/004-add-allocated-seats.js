import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT COUNT(*) AS total FROM booking_tables'
  );

  if (Number(rows[0].total) > 0) {
    throw new Error(
      'Existing booking allocations must be migrated first'
    );
  }

  await queryInterface.addColumn(
    'booking_tables',
    'allocatedSeats',
    {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn(
    'booking_tables',
    'allocatedSeats'
  );
}
