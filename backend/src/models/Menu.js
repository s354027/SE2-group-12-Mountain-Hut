
import { DataTypes } from 'sequelize';

export function defineMenu(sequelize) {
    return sequelize.define('Menu', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0
            }
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },

        slotId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        managerId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'menus',
        timestamps: false
    });
}
