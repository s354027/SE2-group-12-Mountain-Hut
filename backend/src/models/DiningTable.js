/* class with sequelize */
import { DataTypes } from 'sequelize';

export function defineDiningTable(sequelize) {
    return sequelize.define('DiningTable', {
        id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
        },

        tableNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        validate: {
            isInt: true,
            min: 1
        }
        },

        seats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            isInt: true,
            min: 1
        }
        }
    }, {
        tableName: 'dining_tables',
        timestamps: false
    });
}
