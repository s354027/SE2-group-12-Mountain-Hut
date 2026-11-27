import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import availabilityRouter from './routes/availability.routes.js';
import { createSlotRouter } from './routes/slot.routes.js';
import { createTableRouter } from './routes/table.routes.js';
import { models, sequelize } from './db/index.js';
import { createHikerRouter } from './routes/hiker.routes.js';
import { createHikeRouter } from './routes/hike.routes.js';
import bookingRouter from './routes/booking.routes.js';
import menuRouter from './routes/menu.routes.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();

// Allow requests from the frontend
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

// Parse incoming JSON requests
app.use(express.json());

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, '../frontend-dist');

if (process.env.SERVE_FRONTEND === 'true') {
    app.use(express.static(frontendDist));
}

// Session used for authentication (login/logout, role checks)
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
    }
}));

// Health check endpoint
app.get('/health', (_req, res) => {
    // Backend is operative
    res.status(200).json({
        status: 'ok'
    });
});

app.use('/api/auth', createAuthRouter(models));
app.use('/api/admin', createAdminRouter(models));
app.use('/api/availability', availabilityRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/hikers', createHikerRouter({ User: models.User, sequelize }));
app.use('/api/hikes', createHikeRouter({ Hike: models.Hike, User: models.User }));
app.use('/api/slots', createSlotRouter(models));
app.use('/api/tables', createTableRouter(models));
app.use('/api/menus', menuRouter);

if (process.env.SERVE_FRONTEND === 'true') {
    // React Router fallback:
    // requests such as /bookings or /search must return index.html
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) {
            return next();
        }

        return res.sendFile(path.join(frontendDist, 'index.html'));
    });
}

export default app;
