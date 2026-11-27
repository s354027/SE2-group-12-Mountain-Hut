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
    const { User, DiningTable, Slot, Menu, Hike } = models;
    const usersByEmail = {};

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

      usersByEmail[userData.email] = user;
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
    const demoWarden = usersByEmail['warden.demo@mountainhut.local'];

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
        
        await Menu.findOrCreate({
          where: {
              slotId: slot.id
          },
          defaults: {
              description:
                  definition.meal === 'LUNCH'
                      ? 'Pasta, main course and dessert'
                      : 'Soup, main course and dessert',
              price:
                  definition.meal === 'LUNCH' ? 18 : null, // price can be undefined/nullable
              managerId: demoWarden.id
          },
          transaction
        });

        await slot.addTables(tables, { transaction });
      }
    }

    const demoHiker = usersByEmail['hiker.demo@mountainhut.local'];
    const now = new Date();

    const hikeDefinitions = [
      {
        hikerId: demoHiker.id,
        destination: 'Rifugio Vittorio Sella',
        route: 'Ceresole Reale - Lago Serrù - Rifugio Vittorio Sella',
        waypoints: ['Lago Serrù', 'Colle del Nivolet'],
        departureTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        expectedReturnTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        status: 'ONGOING'
      },
      {
        hikerId: demoHiker.id,
        destination: 'Rifugio Gastaldi',
        route: 'Pian della Mussa - Lago delle Rocce - Rifugio Gastaldi',
        waypoints: ['Lago delle Rocce'],
        departureTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        expectedReturnTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        status: 'ONGOING'
      }
    ];

    for (const definition of hikeDefinitions) {
      const [hike, created] = await Hike.findOrCreate({
        where: {
          hikerId: definition.hikerId,
          destination: definition.destination
        },
        defaults: definition,
        transaction
      });

      if (!created) {
        await hike.update({
          departureTime: definition.departureTime,
          expectedReturnTime: definition.expectedReturnTime,
          status: definition.status
        }, { transaction });
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
