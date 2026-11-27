import { defineConfig, devices } from '@playwright/test';

/**
 * E2E dijalankan terpisah dari unit test:
 *   npx playwright install chromium
 *   npm run test:e2e
 *
 * Server dev (port 3000) otomatis dinyalakan dan memakai 3 akun demo mode dev.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --mode test',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
