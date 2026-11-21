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
# Stage 2 - Application
# =========================
FROM node:22-trixie-slim

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy the compiled React application
COPY --from=frontend-build /frontend/dist ./frontend-dist

ENV SERVE_FRONTEND=true

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm start"]