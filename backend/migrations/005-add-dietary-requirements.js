import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn(
    'bookings',
    'dietaryRequirements',
    {
      type: DataTypes.TEXT,
      allowNull: true
    }
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn(
    'bookings',
    'dietaryRequirements'
  );
}
