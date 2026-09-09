import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './.local/browser-test-results',
  workers: 1,
  timeout: 30000,
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4320', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4320',
    url: 'http://127.0.0.1:4320',
    reuseExistingServer: !process.env.CI,
  },
});
