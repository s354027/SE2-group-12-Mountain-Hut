# Backend

This directory contains the server-side application, including APIs, authentication, business logic, and communication with the database.

## Backend Setup

The backend uses **Node.js, Express and JavaScript (ES Modules)**.

### Requirements
- Node.js (22+ recommended)
- npm

### Installation

From the repository root:

```bash
cd backend
npm ci
```

### Run the server

**Development mode** (automatically restarts on changes):

```bash
npm run dev
```

**Standard mode:**

```bash
npm start
```

The server runs locally at `http://localhost:3000` by default.

### Verify the server

Open `http://localhost:3000/health` in your browser.

Expected response:

```json
{
  "status": "ok"
}
```

### Linting

Run ESLint to check the code:

```bash
npm run lint
```

### Configuration

Default settings:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Backend HTTP port |
| `HOST` | `127.0.0.1` | Server listening address |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed frontend origin (CORS) |

These values can be overridden using environment variables.

### Project Structure

- `src/app.js` — Express application and middleware configuration.
- `src/server.js` — HTTP server initialization.
- `src/routes/` — API endpoints.
- `src/controllers/` — Request handlers.
- `src/services/` — Business logic.
- `src/models/` — Data models.
- `src/db/` — Database configuration.
- `eslint.config.js` — ESLint configuration.
