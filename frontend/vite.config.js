import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api to the backend (default port 3000, see backend/README.md).
    proxy: { '/api': backendUrl },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    globals: true,
  },
});
