import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import availabilityRouter from './routes/availability.routes.js';
import { createSlotRouter } from './routes/slot.routes.js';
import { models } from './db/index.js';
import bookingRouter from './routes/booking.routes.js';

const app = express();

// Allow requests from the frontend
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

// Parse incoming JSON requests
app.use(express.json());

// Session used for authentication (login/logout, role checks)
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false
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
app.use('/api/slots', createSlotRouter(models));

export default app;
