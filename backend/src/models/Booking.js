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
        },

        // Free-form list of dietary requirements for the party (MH-05 improvement).
        // Stored as JSON text since sqlite has no native array column.
        dietaryRequirements: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const raw = this.getDataValue('dietaryRequirements');
                return raw ? JSON.parse(raw) : [];
            },
            set(value) {
                this.setDataValue(
                    'dietaryRequirements',
                    Array.isArray(value) && value.length > 0
                        ? JSON.stringify(value)
                        : null
                );
            }
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
