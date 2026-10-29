import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn('slots', 'meal', {
    type: DataTypes.STRING,
    allowNull: false
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('slots', 'meal');
}
