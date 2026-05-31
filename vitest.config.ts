/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Simula um ambiente de browser (necessário para importações de módulos React)
    environment: 'node',
    // Playwright E2E specs under tests/e2e use @playwright/test and run via npm run e2e:*.
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    // Inclui tipagem automática de expect, it, describe etc.
    globals: true,
    // Relatório limpo com diff colorido
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/features/forja/forjaUtils.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
