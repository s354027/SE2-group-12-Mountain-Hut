// sets the many to many relation between table and booking
import { DataTypes } from 'sequelize';

export function defineBookingTable(sequelize) {
  return sequelize.define('BookingTable', {
    bookingId: {
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
    tableName: 'booking_tables',
    timestamps: false
  });
}
