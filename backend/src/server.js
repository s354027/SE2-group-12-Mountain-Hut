import app from './app.js';
import { verifyTransporter } from './services/emailService.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; //for docker set: HOST=0.0.0.0 

verifyTransporter(); // Verify the email transporter before starting the server

app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
});