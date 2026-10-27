
import express from 'express';
import cors from 'cors';

const app = express();

// Allow requests from the frontend
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
}));

// Parse incoming JSON requests
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
    // Backend is operative
    res.status(200).json({
        status: 'ok'
    });
});

export default app;
