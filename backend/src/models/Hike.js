/* class with sequelize */
import { DataTypes } from 'sequelize';

export function defineHike(sequelize) {
    return sequelize.define('Hike', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        hikerId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        destination: {
            type: DataTypes.STRING,
            allowNull: false
        },

        route: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // List of waypoint names along the route.
        // Stored as JSON text since sqlite has no native array column.
        waypoints: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const raw = this.getDataValue('waypoints');
                return raw ? JSON.parse(raw) : [];
            },
            set(value) {
                this.setDataValue(
                    'waypoints',
                    Array.isArray(value) && value.length > 0
                        ? JSON.stringify(value)
                        : null
                );
            }
        },

        departureTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        expectedReturnTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'ONGOING',
            validate: {
                isIn: [['ONGOING', 'RETURNED']]
            }
        }
    }, {
        tableName: 'hikes',
        timestamps: true,
        updatedAt: false
    });
}
