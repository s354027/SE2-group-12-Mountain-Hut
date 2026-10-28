/* class with sequelize */
import { DataTypes } from 'sequelize';

// date and time are already defined in the Slot
export function defineBooking(sequelize) {
    return sequelize.define('Booking', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        hikerId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        slotId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        numberOfPeople: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                isInt: true,
                min: 1
            }
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false
        },

        allergyFlag: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        allergyDescription: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'bookings',
        timestamps: true,
        updatedAt: false,
        validate: {
            allergyDetailsRequired() {
                if (this.allergyFlag &&
                    !this.allergyDescription?.trim()) {
                throw new Error(
                    'Allergy description is required'
                );
                }
            }
        }
    });
}
