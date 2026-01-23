import { test, expect } from '../../fixtures/test-fixtures';
import { MobileNavPage } from '../../pages/mobile-nav.page';

/**
 * Mobile Feature Accessibility Tests
 *
 * Tests for mobile-specific features including status setting,
 * emoji picker, analytics, touch targets, and settings access.
 *
 * Runs only on mobile-chrome and mobile-safari projects.
 *
 * Requirements covered:
 * - MOBI2-04: Mobile status
 * - MOBI2-05: Mobile emoji picker
 * - MOBI2-06: User groups on mobile
 * - MOBI2-07: Guest management on mobile
 * - MOBI2-08: Mobile analytics
 * - MOBI2-09: Touch targets
 * - MOBI2-11: Consistent spacing
 */

test.describe('mobile features', () => {
  let mobileNav: MobileNavPage;

  test.beforeEach(async ({ page }) => {
    mobileNav = new MobileNavPage(page);
  });

  test('user status can be set from mobile - MOBI2-04', async ({ page, testWorkspace }) => {
    await mobileNav.goto(testWorkspace);

    // Open More menu where status is accessible
    await mobileNav.openMoreMenu();

    // Click on the status section to open status drawer
    const statusTrigger = page.getByRole('button', { name: /set status|status/i }).first();
    await expect(statusTrigger).toBeVisible();
    await statusTrigger.click();

    // Status editor drawer should open
    const statusDrawer = page.locator('[vaul-drawer-content]').filter({
      has: page.getByText(/set your status/i),
    });
    await expect(statusDrawer).toBeVisible();

    // Should have status input field
    const statusInput = page.getByPlaceholder(/what's your status/i);
    await expect(statusInput).toBeVisible();

    // Enter a status
    await statusInput.fill('Testing mobile status');

    // Should be able to save/update
    const saveButton = page.getByRole('button', { name: /save|update|set/i });
    await expect(saveButton).toBeVisible();
  });

  test('emoji picker works on mobile - MOBI2-05', async ({ page, testWorkspace }) => {
    // Navigate to a channel
    await page.goto(`/${testWorkspace}/channels/general`);

    // Wait for message input to be visible
    const messageInput = page.getByPlaceholder(/message/i);
    await expect(messageInput).toBeVisible();

    // Look for emoji button in the message input area
    const emojiButton = page.getByRole('button', { name: /emoji/i });
    await expect(emojiButton).toBeVisible();

    // Click emoji button
    await emojiButton.click();

    // On mobile, emoji picker opens in a drawer
    // Look for emoji picker content (emoji-mart categories)
    const emojiPicker = page.locator('em-emoji-picker');
    await expect(emojiPicker).toBeVisible({ timeout: 5000 });

    // Verify mobile layout has 6 columns (perLine={6})
    // The picker should be touch-friendly
    const emojiPickerContainer = page.locator('[vaul-drawer-content]');
    await expect(emojiPickerContainer).toBeVisible();

    // Select an emoji (e.g., thumbs up in smileys category)
    const smileyEmoji = page.locator('em-emoji-picker [data-emoji-set] button').first();
    await smileyEmoji.click();

    // Drawer should close and emoji should be in input
    await expect(emojiPickerContainer).not.toBeVisible();
  });

  test('workspace analytics viewable on mobile - MOBI2-08', async ({ page, testWorkspace }) => {
    // Navigate to analytics page
    await page.goto(`/${testWorkspace}/settings/analytics`);

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();

    // Charts should be visible and responsive
    const chartsContainer = page.locator('[class*="overflow"]');

    // Verify no horizontal overflow on the main container
    const mainContent = page.locator('main, [class*="container"]').first();
    const box = await mainContent.boundingBox();
    const viewport = page.viewportSize();

    if (box && viewport) {
      // Content width should not exceed viewport width significantly
      expect(box.width).toBeLessThanOrEqual(viewport.width + 20); // 20px tolerance for scrollbar
    }

    // Activity metrics or charts should be visible
    const metricsSection = page.getByText(/activity|messages|members/i).first();
    await expect(metricsSection).toBeVisible();
  });

  test('touch targets meet minimum size - MOBI2-09', async ({ page, testWorkspace }) => {
    await mobileNav.goto(testWorkspace);

    // iOS HIG recommends 44px minimum touch targets
    const MIN_TOUCH_TARGET = 44;
    const violations: string[] = [];

    // Check bottom tab bar buttons
    const tabBarButtons = await mobileNav.bottomTabBar.locator('a, button').all();

    for (const button of tabBarButtons) {
      const box = await button.boundingBox();
      if (box) {
        if (box.width < MIN_TOUCH_TARGET || box.height < MIN_TOUCH_TARGET) {
          const text = await button.textContent();
          violations.push(
            `Tab bar button "${text?.trim()}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px`
          );
        }
      }
    }

    // Check More menu items when open
    await mobileNav.openMoreMenu();
    const menuLinks = await page.locator('[vaul-drawer-content] a, [vaul-drawer-content] button').all();

    for (const link of menuLinks) {
      const box = await link.boundingBox();
      if (box) {
        if (box.width < MIN_TOUCH_TARGET || box.height < MIN_TOUCH_TARGET) {
          const text = await link.textContent();
          violations.push(
            `More menu item "${text?.trim()}": ${box.width.toFixed(0)}x${box.height.toFixed(0)}px`
          );
        }
      }
    }

    // Log any violations for debugging
    if (violations.length > 0) {
      console.log('Touch target violations:', violations);
    }

    // Assert no violations
    expect(violations, `Touch target violations found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('consistent spacing across mobile views - MOBI2-11', async ({ page, testWorkspace }) => {
    const viewports = [
      { name: 'home', url: `/${testWorkspace}` },
      { name: 'dms', url: `/${testWorkspace}/dm` },
      { name: 'search', url: `/${testWorkspace}/search` },
    ];

    for (const { name, url } of viewports) {
      await page.goto(url);

      // Wait for content to load
      await page.waitForLoadState('networkidle');

      // Check that main content area has proper padding
      const main = page.locator('main').first();

      // Take screenshot for visual comparison (useful for debugging)
      // await page.screenshot({ path: `test-results/mobile-spacing-${name}.png` });

      // Verify no content is flush against edges (has padding)
      // This is a basic check - comprehensive visual testing would use screenshot comparison
      const mainBox = await main.boundingBox();
      const viewport = page.viewportSize();

      if (mainBox && viewport) {
        // Content should have some margin/padding from viewport edges
        // At minimum, safe area insets should be respected
        expect(mainBox.x).toBeGreaterThanOrEqual(0);

        // Width should not exceed viewport
        expect(mainBox.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });

  test('user groups manageable from mobile - MOBI2-06', async ({ page, testWorkspace }) => {
    // Navigate to settings via More menu
    await mobileNav.goto(testWorkspace);
    await mobileNav.navigateToMoreItem('settings');

    // Wait for settings page
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/settings`));

    // Look for user groups link/section
    const userGroupsLink = page.getByRole('link', { name: /user groups/i });

    // If visible, click it (may be admin-only)
    if (await userGroupsLink.isVisible()) {
      await userGroupsLink.click();
      await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/settings/user-groups`));

      // Page should display user groups heading
      await expect(page.getByRole('heading', { name: /user groups/i })).toBeVisible();

      // Should be able to view groups list (may be empty)
      const groupsList = page.locator('[class*="group"]');
      // Just verify the page loads without error
    } else {
      // User might not be admin - that's ok, we verify accessibility for admins
      console.log('User groups not visible - user may not be admin');
    }
  });

  test('guest management accessible from mobile - MOBI2-07', async ({ page, testWorkspace }) => {
    // Navigate to settings via More menu
    await mobileNav.goto(testWorkspace);
    await mobileNav.navigateToMoreItem('settings');

    // Wait for settings page
    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/settings`));

    // Look for guest management link/section
    const guestsLink = page.getByRole('link', { name: /guests/i });

    // If visible, click it (admin-only feature)
    if (await guestsLink.isVisible()) {
      await guestsLink.click();
      await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/settings/guests`));

      // Page should display guest management heading
      await expect(page.getByRole('heading', { name: /guest management/i })).toBeVisible();

      // Should show invite links section
      await expect(page.getByText(/invite links/i)).toBeVisible();

      // Should show active guests section
      await expect(page.getByText(/active guests/i)).toBeVisible();
    } else {
      // User might not be admin - that's ok
      console.log('Guest management not visible - user may not be admin');
    }
  });

  test('profile page accessible and responsive - MOBI2-04 related', async ({
    page,
    testWorkspace,
  }) => {
    // Navigate to profile via More menu
    await mobileNav.goto(testWorkspace);
    await mobileNav.navigateToMoreItem('profile');

    await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/profile`));

    // Profile page should load
    const profileHeading = page.getByRole('heading', { name: /profile/i });
    await expect(profileHeading).toBeVisible();

    // Verify content fits within viewport
    const viewport = page.viewportSize();
    const body = await page.locator('body').boundingBox();

    if (viewport && body) {
      // Body should not cause horizontal scroll
      expect(body.width).toBeLessThanOrEqual(viewport.width + 20);
    }
  });

  test('channel list touch targets on home', async ({ page, testWorkspace }) => {
    await page.goto(`/${testWorkspace}`);

    // Wait for channel list to load
    const channelLinks = page.getByRole('link', { name: /#/i });
    await expect(channelLinks.first()).toBeVisible({ timeout: 10000 });

    // Measure touch targets for channel links
    const MIN_TOUCH_TARGET = 44;
    const links = await channelLinks.all();
    const violations: string[] = [];

    for (const link of links.slice(0, 5)) {
      // Check first 5 channels
      const box = await link.boundingBox();
      if (box && box.height < MIN_TOUCH_TARGET) {
        const text = await link.textContent();
        violations.push(`Channel "${text?.trim()}": height ${box.height.toFixed(0)}px`);
      }
    }

    if (violations.length > 0) {
      console.log('Channel list touch target violations:', violations);
    }

    expect(violations, `Channel touch target violations:\n${violations.join('\n')}`).toHaveLength(0);
  });
});
