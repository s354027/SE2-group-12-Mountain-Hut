// Temporary in-memory DB, used until the real connection (MH-45) lands.
// Swap the import of `db` in app.js for the real one once it's available.
import { Sequelize } from 'sequelize';
import { initModels } from '../models/index.js';

export const sequelize = new Sequelize('sqlite::memory:', { logging: false });
export const db = initModels(sequelize);

export async function resetTestDb() {
  await sequelize.sync({ force: true });
}
