# =========================
# Stage 1 - Build frontend
# =========================
FROM node:22-trixie-slim AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# =========================
# Stage 2 - Mailpit source
# =========================
FROM axllent/mailpit:v1.33.1 AS mailpit


# =========================
# Stage 3 - Final application
# =========================
FROM node:22-trixie-slim AS application

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

COPY --from=frontend-build /frontend/dist ./frontend-dist
COPY --from=mailpit /mailpit /usr/local/bin/mailpit

COPY docker-entrypoint.sh /usr/local/bin/mountain-hut-entrypoint.sh
RUN chmod +x /usr/local/bin/mountain-hut-entrypoint.sh

ENV PORT=3000
ENV HOST=0.0.0.0
ENV FRONTEND_ORIGIN=http://localhost:3000
ENV DB_PATH=/app/data/mountain-hut.sqlite
ENV SERVE_FRONTEND=true

ENV SMTP_HOST=127.0.0.1
ENV SMTP_PORT=1025

ENV MP_MAX_MESSAGES=5000
ENV MP_DATABASE=/app/data/mailpit.db

EXPOSE 3000
EXPOSE 8025

ENTRYPOINT ["/usr/local/bin/mountain-hut-entrypoint.sh"]