import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Umzug, SequelizeStorage } from 'umzug';

import sequelize from './sequelize.js';

// Absolute path to backend/migrations/
const migrationsDir = fileURLToPath(
    new URL('../../migrations/', import.meta.url)
);

// Discover migration files in execution order
const files = (await readdir(migrationsDir))
    .filter(name => /^\d+.*\.js$/.test(name))
    .sort();

// Load ES Modules, including on Windows
const migrations = await Promise.all(
    files.map(async name => {
            const filePath = join(migrationsDir, name);
            const migration = await import(
            pathToFileURL(filePath).href
        );

        return {
            name,
            up: migration.up, //createst tables and indexes
            down: migration.down //blocks the migration and drops the relative tables
        };
    })
);

export const migrator = new Umzug({
    migrations,
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console
});
