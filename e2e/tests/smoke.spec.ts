import { test, expect } from '../fixtures/test-fixtures';

/**
 * Smoke tests to verify E2E test infrastructure works.
 * These tests validate the basic setup before running full test suites.
 */

test.describe('smoke tests', () => {
  test('can load homepage', async ({ page }) => {
    // Navigate to the root URL
    await page.goto('/');

    // The homepage should redirect to sign-in or show the landing page
    // Either way, the page should load without errors
    await expect(page).toHaveTitle(/OComms/i);
  });

  test('can navigate to workspace with auth', async ({ authenticatedPage, testWorkspace }) => {
    // Navigate to the test workspace
    await authenticatedPage.goto(`/${testWorkspace}`);

    // Should be on the workspace page (not redirected to sign-in)
    await expect(authenticatedPage).toHaveURL(new RegExp(`/${testWorkspace}`));

    // Should see the workspace content (sidebar with channels)
    await expect(authenticatedPage.locator('nav')).toBeVisible();
  });

  test('can see channel list in sidebar', async ({ authenticatedPage, testWorkspace }) => {
    // Navigate to the test workspace
    await authenticatedPage.goto(`/${testWorkspace}`);

    // Wait for the sidebar to load
    await expect(authenticatedPage.locator('nav')).toBeVisible();

    // Should see at least one channel (general is created by default)
    const channelLinks = authenticatedPage.getByRole('link', { name: /#/i });
    await expect(channelLinks.first()).toBeVisible({ timeout: 10000 });
  });
});
