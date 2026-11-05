import { models, sequelize } from '../src/db/index.js';
import { hashPassword } from '../src/services/authService.js';

const userDefinitions = [
  {
    firstName: 'Demo',
    lastName: 'Hiker',
    email: 'hiker.demo@mountainhut.local',
    password: 'DemoHiker123',
    phone: '+391234567890',
    role: 'HIKER'
  },
  {
    firstName: 'Demo',
    lastName: 'Employee',
    email: 'employee.demo@mountainhut.local',
    password: 'DemoEmployee123',
    phone: '+391234567891',
    role: 'EMPLOYEE'
  },
  {
    firstName: 'Demo',
    lastName: 'Warden',
    email: 'warden.demo@mountainhut.local',
    password: 'DemoWarden123',
    phone: '+391234567892',
    role: 'WARDEN'
  }
];

const tableDefinitions = [
  { tableNumber: 1, seats: 2 },
  { tableNumber: 2, seats: 2 },
  { tableNumber: 3, seats: 4 },
  { tableNumber: 4, seats: 4 },
  { tableNumber: 5, seats: 6 },
  { tableNumber: 6, seats: 6 },
  { tableNumber: 7, seats: 4 },
];

const slotDefinitions = [
  { startTime: '12:00:00', meal: 'LUNCH' },
  { startTime: '19:00:00', meal: 'DINNER' }
];

function getSeedDates(days) {
  const today = new Date();
  const dates = [];

  for (let offset = 0; offset <= days; offset += 1) {
    const date = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset
    ));
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

async function seed() {
  await sequelize.authenticate();

  /**
   * Adds demo users, tables, and slots for the next seven days to the database.
   */
  await sequelize.transaction(async transaction => {
    const { User, DiningTable, Slot } = models;

    for (const definition of userDefinitions) {
      const { password, ...userData } = definition;
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: {
          ...userData,
          passwordHash: await hashPassword(password)
        },
        transaction
      });

      if (!created) {
        await user.update({
          passwordHash: await hashPassword(password),
          role: userData.role
        }, { transaction });
      }
    }

    const tables = [];

    for (const definition of tableDefinitions) {
      const [table] = await DiningTable.findOrCreate({
        where: { tableNumber: definition.tableNumber },
        defaults: definition,
        transaction
      });
      tables.push(table);
    }

    const totalCapacity = tables.reduce((sum, table) => sum + table.seats, 0);

    for (const date of getSeedDates(7)) {
      for (const definition of slotDefinitions) {
        const [slot] = await Slot.findOrCreate({
          where: {
            date,
            startTime: definition.startTime,
            meal: definition.meal
          },
          defaults: {
            duration: 120,
            totalCapacity,
            status: 'OPEN'
          },
          transaction
        });

        await slot.addTables(tables, { transaction });
      }
    }
  });

  console.log('Seed data created for the next seven days and demo users.');
}

try {
  await seed();
} catch (error) {
  console.error('Seed error:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
