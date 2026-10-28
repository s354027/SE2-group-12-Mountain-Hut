// this code links each model with the others
import { defineUser } from './User.js';
import { defineSlot } from './Slot.js';
import { defineDiningTable } from './DiningTable.js';
import { defineBooking } from './Booking.js';
import { defineBookingTable } from './BookingTable.js';
import { defineSlotTable } from './SlotTable.js';
import { defineMenu } from './Menu.js';

export function initModels(sequelize) {
    const User = defineUser(sequelize);
    const Slot = defineSlot(sequelize);
    const DiningTable = defineDiningTable(sequelize);
    const Booking = defineBooking(sequelize);
    const BookingTable = defineBookingTable(sequelize);
    const SlotTable = defineSlotTable(sequelize);
    const Menu = defineMenu(sequelize);

    // Hiker 1:N Booking
    User.hasMany(Booking, {
        foreignKey: 'hikerId',
        as: 'bookings'
    });

    Booking.belongsTo(User, {
        foreignKey: 'hikerId',
        as: 'hiker'
    });

    // Slot 1:N Booking
    Slot.hasMany(Booking, {
        foreignKey: 'slotId',
        as: 'bookings'
    });

    Booking.belongsTo(Slot, {
        foreignKey: 'slotId',
        as: 'slot'
    });

    // Booking N:M DiningTable
    Booking.belongsToMany(DiningTable, {
        through: BookingTable,
        foreignKey: 'bookingId',
        otherKey: 'tableId',
        as: 'tables'
    });

    DiningTable.belongsToMany(Booking, {
        through: BookingTable,
        foreignKey: 'tableId',
        otherKey: 'bookingId',
        as: 'bookings'
    });

    // Slot N:M DiningTable
    Slot.belongsToMany(DiningTable, {
        through: SlotTable,
        foreignKey: 'slotId',
        otherKey: 'tableId',
        as: 'tables'
    });

    DiningTable.belongsToMany(Slot, {
        through: SlotTable,
        foreignKey: 'tableId',
        otherKey: 'slotId',
        as: 'slots'
    });

    // Slot 1:N Menu
    Slot.hasMany(Menu, {
        foreignKey: 'slotId',
        as: 'menus'
    });

    Menu.belongsTo(Slot, {
        foreignKey: 'slotId',
        as: 'slot'
    });

    // Employee 1:N Menu
    User.hasMany(Menu, {
        foreignKey: 'managerId',
        as: 'managedMenus'
    });

    Menu.belongsTo(User, {
        foreignKey: 'managerId',
        as: 'manager'
    });

    return {
        User,
        Slot,
        DiningTable,
        Booking,
        BookingTable,
        SlotTable,
        Menu
    };
}
