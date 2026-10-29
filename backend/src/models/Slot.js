/* class with sequelize */
import { DataTypes } from 'sequelize';

export function defineSlot(sequelize) {
  return sequelize.define('Slot', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    startTime: {
      type: DataTypes.TIME,
      allowNull: false
    },

    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: true,
        min: 1
      }
    },

    meal: {
      type: DataTypes.STRING,
      allowNull: false, // es. 'LUNCH', 'DINNER'
      validate: {
        isIn: [['LUNCH', 'DINNER']]
      }
    },
    totalCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isInt: true,
        min: 1
      }
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OPEN'
    }
  }, {
    tableName: 'slots',
    timestamps: false
  });
}

