import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 }
    },
    trace: 'off',
    screenshot: 'on',
  },
  outputDir: 'test-results',
  webServer: {
    command: 'npm run start',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        video: {
          mode: 'on',
          size: { width: 1280, height: 720 }
        }
      },
    },
  ],
});
