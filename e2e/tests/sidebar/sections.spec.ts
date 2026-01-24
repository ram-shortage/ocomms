import { test, expect } from '@playwright/test';
import { SidebarPage } from '../../pages/sidebar.page';

/**
 * Sidebar Sections E2E Tests
 *
 * Tests sidebar section visibility and navigation functionality.
 * Uses demo-seed data with comprehensive workspace/channel structure.
 */

test.describe('Sidebar Sections', () => {
  test('sidebar shows expected sections', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/acme-corp');
    await page.waitForLoadState('networkidle');

    // Verify Channels section exists
    const channelsSection = page.locator('aside').getByRole('button', { name: /channels/i });
    await expect(channelsSection).toBeVisible();

    // Verify Direct Messages section exists
    const dmSection = page.locator('aside').getByRole('button', { name: /direct messages/i });
    await expect(dmSection).toBeVisible();

    // Verify quick links section exists (Threads, Search, etc.)
    const threadsLink = page.locator('aside').getByRole('link', { name: /threads/i });
    await expect(threadsLink).toBeVisible();
  });

  test('channels section shows workspace channels', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/acme-corp');
    await page.waitForLoadState('networkidle');

    // Check if channels are visible, if not expand the section
    const channelLinks = page.locator('aside a[href*="/channels/"]');
    let channelCount = await channelLinks.count();

    if (channelCount === 0) {
      // Click Channels button to expand section
      const channelsSection = page.locator('aside').getByRole('button', { name: /^channels$/i });
      await channelsSection.click();
      await page.waitForTimeout(500); // Wait for animation and render

      // Re-check channel count after expanding
      channelCount = await channelLinks.count();
    }

    // Verify at least one channel is visible
    // Demo seed creates channels like: general, engineering, backend, etc.
    expect(channelCount).toBeGreaterThan(0);

    // Verify general channel exists (standard channel in demo seed)
    // Channel names in sidebar may have # prefix, so match flexibly
    const generalChannel = page.locator('aside a[href*="/channels/general"]');
    await expect(generalChannel).toBeVisible();
  });

  test('direct messages section shows conversations', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/acme-corp');
    await page.waitForLoadState('networkidle');

    // Expand Direct Messages section if collapsed
    const dmSection = page.locator('aside').getByRole('button', { name: /direct messages/i });
    const isExpanded = await dmSection.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await dmSection.click();
      await page.waitForTimeout(300); // Wait for animation
    }

    // Check for DM conversations
    // Note: Demo seed may or may not have DMs for Alice depending on data generation
    const dmLinks = page.locator('aside a[href*="/dm/"]');
    const dmCount = await dmLinks.count();

    // Either DMs exist or the "No direct messages yet" message appears
    if (dmCount === 0) {
      const emptyMessage = page.locator('aside').getByText(/no direct messages/i);
      await expect(emptyMessage).toBeVisible();
    } else {
      expect(dmCount).toBeGreaterThan(0);
    }
  });

  test('clicking channel navigates to it', async ({ page }) => {
    // Navigate to workspace
    await page.goto('/acme-corp');
    await page.waitForLoadState('networkidle');

    // Check if channels are visible, if not expand the section
    const channelLinks = page.locator('aside a[href*="/channels/"]');
    let channelCount = await channelLinks.count();

    if (channelCount === 0) {
      // Click Channels button to expand section
      const channelsSection = page.locator('aside').getByRole('button', { name: /^channels$/i });
      await channelsSection.click();
      await page.waitForTimeout(500); // Wait for animation and render
    }

    // Click on the general channel
    const generalChannel = page.locator('aside a[href*="/channels/general"]');
    await expect(generalChannel).toBeVisible();
    await generalChannel.click();

    // Verify URL changes to channel route
    await expect(page).toHaveURL(/\/acme-corp\/channels\/general/);

    // Verify channel content loads (header shows channel name)
    const channelHeader = page.locator('header h1, main h1').first();
    await expect(channelHeader).toContainText(/general/i);
  });
});
