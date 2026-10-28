import app from './app.js';
import { sequelize } from './db/index.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; //for docker set: HOST=0.0.0.0 

async function startServer() {
    try {
        // Verify database connection
        await sequelize.authenticate();
        console.log('Database connection established.');

        // Start HTTP server
        app.listen(PORT, HOST, () => {
            console.log(
                `Server running at http://${HOST}:${PORT}`
            );
        });

    } catch (error) {
        console.error('Unable to start the server:', error);
        await sequelize.close();
        process.exitCode = 1;
    }
}

await startServer();