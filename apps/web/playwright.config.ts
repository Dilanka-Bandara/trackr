import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? { channel: 'chrome' } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
