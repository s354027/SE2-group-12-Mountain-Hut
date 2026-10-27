import app from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; //for docker set: HOST=0.0.0.0 


app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
});