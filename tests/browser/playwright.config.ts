import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  forbidOnly: true,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../test-results',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    cwd: '../..',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
