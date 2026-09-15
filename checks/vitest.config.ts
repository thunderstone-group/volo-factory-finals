import { defineConfig } from 'vitest/config';

// Generated Playwright specs are a different test runner, even after calibration.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], pool: 'threads' } });
