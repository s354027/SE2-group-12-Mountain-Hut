import sequelize from '../src/db/sequelize.js';
import { migrator } from '../src/db/migrator.js';

const command = process.argv[2] ?? 'up';

try {
    await sequelize.authenticate();

    switch (command) {
        case 'up': {
            const applied = await migrator.up();
            console.log(
                `Applied ${applied.length} migration(s).`
            );
            break;
        }

        case 'status': {
            const executed = await migrator.executed();
            const pending = await migrator.pending();

            console.log('Executed migrations:');
            console.table(executed.map(m => m.name));

            console.log('Pending migrations:');
            console.table(pending.map(m => m.name));
            break;
        }

        case 'down': {
            const reverted = await migrator.down();
            console.log('Reverted:', reverted.name);
            break;
        }

        default:
            throw new Error(`Unknown command: ${command}`);
    }
} 

catch (error) {
    console.error('Migration error:', error);
    process.exitCode = 1;
} 

finally {
    await sequelize.close();
}
