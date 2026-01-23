import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for OComms E2E testing.
 *
 * Projects:
 * - setup: Authenticates test users and saves storage state
 * - chromium: Desktop Chrome tests
 * - mobile-chrome: Mobile Chrome (Pixel 5) tests - matches mobile folder specs
 * - mobile-safari: Mobile Safari (iPhone 13) tests - matches mobile folder specs
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Authentication setup - runs first
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/alice.json',
      },
      dependencies: ['setup'],
      testIgnore: '**/mobile/**/*.spec.ts',
    },

    // Mobile Chrome (Pixel 5)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/alice.json',
      },
      dependencies: ['setup'],
      testMatch: '**/mobile/**/*.spec.ts',
    },

    // Mobile Safari (iPhone 13)
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        storageState: 'e2e/.auth/alice.json',
      },
      dependencies: ['setup'],
      testMatch: '**/mobile/**/*.spec.ts',
    },
  ],

  // Web server configuration - starts Docker Compose test stack
  webServer: {
    command: 'docker compose -f docker-compose.test.yml up',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for container build/start
  },
});
