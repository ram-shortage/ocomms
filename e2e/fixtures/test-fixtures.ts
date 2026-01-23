import { test as base, expect } from '@playwright/test';

/**
 * Custom fixtures for OComms E2E tests.
 *
 * Provides:
 * - authenticatedPage: A page with pre-loaded authentication state
 * - testWorkspace: The default test workspace slug
 */

// Define custom fixture types
type TestFixtures = {
  authenticatedPage: import('@playwright/test').Page;
  testWorkspace: string;
};

/**
 * Extended test with OComms-specific fixtures.
 */
export const test = base.extend<TestFixtures>({
  // Authenticated page fixture - uses storage state from setup
  authenticatedPage: async ({ page }, use) => {
    // The page already has auth state loaded from storageState in config
    // This fixture just provides a semantic alias
    await use(page);
  },

  // Test workspace fixture - returns the default workspace slug
  testWorkspace: async ({}, use) => {
    // This matches the demo seed data workspace
    await use('acme-corp');
  },
});

// Re-export expect for convenience
export { expect };
