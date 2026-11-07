import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// api-то на family слуша на 127.0.0.1:API_PORT (по подразбиране 18091), както в docker-compose.yml на family.
const API_PORT = process.env.API_PORT || '18091';
const API_TARGET = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ADR-0002: договорите от изходния код на family (submodule), не от build-нат пакет.
      '@family/shared': fileURLToPath(
        new URL(
          './vendor/family/packages/shared/src/index.ts',
          import.meta.url,
        ),
      ),
    },
  },
  server: {
    // 5173 е на web-а на family; двете се пускат едно до друго.
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': API_TARGET,
      '/healthz': API_TARGET,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    // По-дълъг от asyncUtilTimeout в setup.ts, за да падне чакането с ясна грешка, а не целият тест.
    testTimeout: 15_000,
  },
});
