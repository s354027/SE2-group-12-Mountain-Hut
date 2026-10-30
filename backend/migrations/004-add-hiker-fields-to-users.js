import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn('users', 'notes', {
    type: DataTypes.TEXT,
    allowNull: true
  });
  await queryInterface.addColumn('users', 'emergencyContact', {
    type: DataTypes.STRING,
    allowNull: true
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('users', 'notes');
  await queryInterface.removeColumn('users', 'emergencyContact');
}