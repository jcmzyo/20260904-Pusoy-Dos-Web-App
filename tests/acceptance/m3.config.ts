import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/acceptance/m3-reliability.acceptance.ts'],
    disableConsoleIntercept: true,
    // Harness timeout only, not a performance acceptance target.
    testTimeout: 120000,
  },
});
