// sets a many to many relation between slot and table
import { DataTypes } from 'sequelize';

export function defineSlotTable(sequelize) {
  return sequelize.define('SlotTable', {
    slotId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },

    tableId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    }
  }, {
    tableName: 'slot_tables',
    timestamps: false
  });
}
