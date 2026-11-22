#!/bin/sh
set -e

mkdir -p /app/data

SECRET_FILE="/app/data/session-secret"

if [ ! -s "$SECRET_FILE" ]; then
    echo "Generating session secret..."
    node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
fi

export SESSION_SECRET="$(cat "$SECRET_FILE")"

FIRST_RUN=false

if [ ! -f "$DB_PATH" ]; then
    FIRST_RUN=true
fi

export MP_SMTP_AUTH_ACCEPT_ANY=1
export MP_SMTP_AUTH_ALLOW_INSECURE=1

echo "Starting Mailpit..."
mailpit &

echo "Running database migrations..."
npm run db:migrate

if [ "$FIRST_RUN" = true ]; then
    echo "First start detected. Loading demo data..."
    npm run db:seed
fi

echo "Starting Mountain Hut..."
exec npm start