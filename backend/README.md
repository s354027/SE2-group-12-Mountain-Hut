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


## Database & Migrations

The backend uses **SQLite** with **Sequelize ORM** and **Umzug** for versioned database migrations.

### Initial Setup

From the `backend/` directory, install dependencies and initialize the database:

```bash
npm ci
npm run db:migrate
```

The SQLite database is stored in `backend/data/mountain-hut.sqlite` by default. Its location can be overridden using the `DB_PATH` environment variable.

### Migration Commands

| Command | Description |
|---|---|
| `npm run db:migrate` | Apply all pending migrations |
| `npm run db:status` | Show applied and pending migrations |
| `npm run db:undo` | Revert the most recently applied migration |
| `npm run dev` | Start the backend in development mode |

Migrations are tracked automatically in the `SequelizeMeta` table, preventing previously applied migrations from running again.

**Warning:** Rolling back a migration may permanently delete tables or data. Back up important data before using `db:undo`.

### Creating or Updating Migrations

Whenever the database schema changes:

1. Update the corresponding Sequelize model in `src/models/`.
2. Create a new numbered migration file inside `migrations/`, e.g. `002-add-booking-notes.js`.
3. Implement `up()` to apply the schema changes and `down()` to revert them.
4. Run `npm run db:migrate` to apply the migration.
5. Verify the database structure and run the tests.
6. Commit both the updated models and the new migration file.

Example migration:

```javascript
import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn('bookings', 'notes', {
    type: DataTypes.TEXT,
    allowNull: true
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn('bookings', 'notes');
}
```

**Important:** Never modify an already applied and shared migration. Create a new migration instead.

### Running the Application

After pulling changes that include new migrations:

```bash
npm ci
npm run db:migrate
npm run dev
```

Migrations must be applied before starting the backend whenever the database schema has changed.

The SQLite database file is excluded from Git. Migration files must be committed so that every developer can reproduce the same database structure.