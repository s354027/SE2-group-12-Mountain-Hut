import { Sequelize } from 'sequelize';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Default database location
const defaultPath = fileURLToPath(
    new URL('../../data/mountain-hut.sqlite', import.meta.url)
);

// Allow a custom database location
const dbPath = process.env.DB_PATH ? resolve(process.env.DB_PATH) : defaultPath;

// Ensure the database directory exists
mkdirSync(dirname(dbPath), { recursive: true });

// Create the Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

export default sequelize;
