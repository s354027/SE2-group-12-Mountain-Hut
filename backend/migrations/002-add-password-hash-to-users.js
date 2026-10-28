import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
    await queryInterface.addColumn('users', 'passwordHash', {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
    });
}

export async function down({ context: queryInterface }) {
    await queryInterface.removeColumn('users', 'passwordHash');
}
