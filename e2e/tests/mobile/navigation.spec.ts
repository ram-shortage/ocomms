import { test, expect } from '../../fixtures/test-fixtures';
import { MobileNavPage } from '../../pages/mobile-nav.page';

/**
 * Mobile Navigation Tests
 *
 * Tests for mobile bottom tab bar navigation, route highlighting,
 * and More menu access to additional features.
 *
 * Runs only on mobile-chrome and mobile-safari projects (Pixel 5, iPhone 13).
 *
 * Requirements covered:
 * - MOBI2-01: Scheduled messages access
 * - MOBI2-02: Reminders access
 * - MOBI2-03: Bookmarks/saved items access
 * - MOBI2-10: Channel header overflow menu
 * - MOBI2-12: Nav route highlighting
 */

test.describe('mobile navigation', () => {
  let mobileNav: MobileNavPage;

  test.beforeEach(async ({ page }) => {
    mobileNav = new MobileNavPage(page);
  });

  test('bottom tab bar displays on mobile', async ({ testWorkspace }) => {
    // Navigate to workspace
    await mobileNav.goto(testWorkspace);

    // Verify bottom tab bar is visible
    await mobileNav.expectBottomTabBarVisible();

    // Verify all primary tabs are visible
    await expect(mobileNav.homeTab).toBeVisible();
    await expect(mobileNav.dmTab).toBeVisible();
    await expect(mobileNav.mentionsTab).toBeVisible();
    await expect(mobileNav.searchTab).toBeVisible();
    await expect(mobileNav.moreButton).toBeVisible();

    // Verify desktop sidebar is NOT visible (confirms mobile layout)
    await mobileNav.expectDesktopSidebarNotVisible();
  });

  test('mobile navigation highlights current route - MOBI2-12', async ({ page, testWorkspace }) => {
    // Navigate to home tab (workspace root)
    await mobileNav.goto(testWorkspace);
    await mobileNav.expectTabActive('home');
    await mobileNav.expectTabInactive('dms');
    await mobileNav.expectTabInactive('search');

    // Navigate to DMs
    await mobileNav.navigateToTab('dms');
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/dm`));
    await mobileNav.expectTabActive('dms');
    await mobileNav.expectTabInactive('home');

    // Navigate to Search
    await mobileNav.navigateToTab('search');
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/search`));
    await mobileNav.expectTabActive('search');
    await mobileNav.expectTabInactive('dms');

    // Navigate to Mentions
    await mobileNav.navigateToTab('mentions');
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/threads`));
    await mobileNav.expectTabActive('mentions');
    await mobileNav.expectTabInactive('search');

    // Navigate back to Home
    await mobileNav.navigateToTab('home');
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}$`));
    await mobileNav.expectTabActive('home');
  });

  test('More menu provides access to additional features - MOBI2-01, -02, -03', async ({
    page,
    testWorkspace,
  }) => {
    await mobileNav.goto(testWorkspace);

    // Open More menu
    await mobileNav.openMoreMenu();

    // Verify all More menu options are visible
    await expect(mobileNav.scheduledMessagesLink).toBeVisible();
    await expect(mobileNav.remindersLink).toBeVisible();
    await expect(mobileNav.savedItemsLink).toBeVisible();
    await expect(mobileNav.notesLink).toBeVisible();
    await expect(mobileNav.settingsLink).toBeVisible();
    await expect(mobileNav.profileLink).toBeVisible();

    // Navigate to Scheduled Messages (MOBI2-01)
    await mobileNav.scheduledMessagesLink.click();
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/scheduled`));

    // When on a More menu route, the More button should be highlighted
    await mobileNav.expectTabActive('more');
    await mobileNav.expectTabInactive('home');

    // Navigate to Reminders (MOBI2-02)
    await mobileNav.navigateToMoreItem('reminders');
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/reminders`));

    // Navigate to Saved Items (MOBI2-03)
    await mobileNav.navigateToMoreItem('saved');
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/saved`));
  });

  test('channel header uses overflow menu on mobile - MOBI2-10', async ({ page, testWorkspace }) => {
    // Navigate to a channel (general should exist)
    await page.goto(`/${testWorkspace}/channels/general`);

    // Wait for page to load
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Desktop action buttons should NOT be visible
    // (They have hidden md:flex class, so hidden on mobile)
    const desktopActions = page.locator('.hidden.md\\:flex');
    await expect(desktopActions).not.toBeVisible();

    // Mobile overflow menu button should be visible
    const overflowButton = page.locator('.md\\:hidden').getByRole('button', {
      name: /channel actions/i,
    });
    await expect(overflowButton).toBeVisible();

    // Click overflow menu
    await overflowButton.click();

    // Verify menu items are accessible
    const menuContent = page.locator('[role="menu"]');
    await expect(menuContent).toBeVisible();

    // Verify key actions are in the menu
    await expect(page.getByRole('menuitem', { name: /notifications/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /channel notes/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /pinned messages/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /members/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /leave channel/i })).toBeVisible();

    // Click outside to close menu
    await page.keyboard.press('Escape');
  });

  test('navigation to channel keeps home tab active', async ({ page, testWorkspace }) => {
    // Navigate to workspace home
    await mobileNav.goto(testWorkspace);
    await mobileNav.expectTabActive('home');

    // Click on a channel link (simulating sidebar navigation on desktop,
    // or channel list on mobile home view)
    await page.goto(`/${testWorkspace}/channels/general`);

    // Home tab should still be active for channel routes
    await mobileNav.expectTabActive('home');
    await mobileNav.expectTabInactive('dms');
    await mobileNav.expectTabInactive('search');
  });

  test('More menu shows current status section - MOBI2-04', async ({ testWorkspace }) => {
    await mobileNav.goto(testWorkspace);

    // Open More menu
    await mobileNav.openMoreMenu();

    // Status button/section should be visible
    // Either shows "Set status" or displays current status
    const statusSection = mobileNav.page.getByRole('button', { name: /set status|status/i });
    await expect(statusSection).toBeVisible();
  });
});
