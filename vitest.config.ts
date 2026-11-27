import { defineConfig } from 'vitest/config';

// The arcade's own unit tests; each game in games/ runs its own suite (`npm test` runs them all).
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
