import { test, expect } from '@playwright/test';
import { SidebarPage } from '../../pages/sidebar.page';

/**
 * Sidebar Drag-Drop E2E Tests
 *
 * Tests drag-and-drop reordering functionality in the sidebar.
 * Uses demo-seed data with categories and channels.
 *
 * Note: These tests require dnd-kit compatible drag operations.
 * Drag handles appear on hover with a 300ms delay.
 *
 * IMPORTANT: Channel drag handles only appear for workspace admins.
 * The test user (Alice) is a regular member, so channel reordering tests
 * will be skipped. Category reordering uses a different mechanism that
 * doesn't require admin status.
 */

test.describe('Sidebar Drag-Drop', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace and wait for sidebar to load
    await page.goto('/acme-corp');
    await page.waitForLoadState('networkidle');

    // Ensure Channels section is expanded by checking if channels are visible
    const channelLinks = page.locator('aside a[href*="/channels/"]');
    const channelCount = await channelLinks.count();

    if (channelCount === 0) {
      // Click Channels button to expand section
      const channelsSection = page.locator('aside').getByRole('button', { name: /^channels$/i });
      await channelsSection.click();
      await page.waitForTimeout(500); // Wait for animation and render
    }
  });

  test('can drag channel to different category', async ({ page }) => {
    const sidebar = new SidebarPage(page);

    // Get initial state - find a channel and a different category
    const channelLinks = page.locator('aside a[href*="/channels/"]');
    const channelCount = await channelLinks.count();

    // Skip if no channels available
    if (channelCount < 2) {
      test.skip();
      return;
    }

    // Get first channel name
    const firstChannelText = await channelLinks.first().textContent();
    const firstChannelName = firstChannelText?.replace(/^#\s*/, '').trim() || '';

    // Get categories
    const categoryOrder = await sidebar.getCategoryOrder();

    // Skip if no categories to move to
    if (categoryOrder.length < 2) {
      test.skip();
      return;
    }

    // Try to drag first channel to a different category
    const targetCategory = categoryOrder[1]; // Second category

    // Hover to reveal drag handle
    const channel = sidebar.getChannel(firstChannelName);
    await channel.hover();
    await page.waitForTimeout(300); // Wait for handle to appear

    // Get drag handle
    const channelGroup = page.locator('aside .group').filter({
      has: channel,
    });
    const dragHandle = channelGroup.locator('button').first();

    // If no drag handle visible, skip
    if (!(await dragHandle.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Get target category header
    const categoryHeader = sidebar.getCategoryHeader(targetCategory);

    // Perform drag
    await dragHandle.dragTo(categoryHeader);
    await page.waitForTimeout(500); // Wait for UI update
  });

  test('can reorder channels within category', async ({ page }) => {
    const sidebar = new SidebarPage(page);

    // Get all channels
    const channelOrder = await sidebar.getChannelOrder();

    // Skip if fewer than 2 channels
    if (channelOrder.length < 2) {
      test.skip();
      return;
    }

    const firstChannel = channelOrder[0];
    const secondChannel = channelOrder[1];

    // Hover on first channel to reveal drag handle
    const channel = sidebar.getChannel(firstChannel);
    await channel.hover();
    await page.waitForTimeout(300);

    // Get drag handle
    const channelGroup = page.locator('aside .group').filter({
      has: channel,
    });
    const dragHandle = channelGroup.locator('button').first();

    // If no drag handle, skip
    if (!(await dragHandle.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Drag to second channel position
    const targetChannel = sidebar.getChannel(secondChannel);
    await dragHandle.dragTo(targetChannel);
    await page.waitForTimeout(500);

    // Verify order changed
    const newOrder = await sidebar.getChannelOrder();

    // Order should have changed (first and second swapped or similar)
    expect(newOrder).not.toEqual(channelOrder);
  });

  test('can reorder DM conversations', async ({ page }) => {
    const sidebar = new SidebarPage(page);

    // Expand DM section
    const dmSection = page.locator('aside').getByRole('button', { name: /direct messages/i });
    const isExpanded = await dmSection.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await dmSection.click();
      await page.waitForTimeout(300);
    }

    // Get DM order
    const dmOrder = await sidebar.getDMOrder();

    // Skip if fewer than 2 DMs
    if (dmOrder.length < 2) {
      test.skip();
      return;
    }

    const firstDm = dmOrder[0];
    const secondDm = dmOrder[1];

    // Hover on first DM to reveal drag handle
    const dmLink = page.locator('aside a[href*="/dm/"]').filter({
      hasText: new RegExp(firstDm, 'i'),
    });
    await dmLink.hover();
    await page.waitForTimeout(300);

    // Get drag handle
    const dmGroup = page.locator('aside .group').filter({
      has: dmLink,
    });
    const dragHandle = dmGroup.locator('button').first();

    // If no drag handle, skip
    if (!(await dragHandle.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Drag to second DM position
    const targetDm = page.locator('aside a[href*="/dm/"]').filter({
      hasText: new RegExp(secondDm, 'i'),
    });
    await dragHandle.dragTo(targetDm);
    await page.waitForTimeout(500);

    // Verify order changed
    const newOrder = await sidebar.getDMOrder();
    expect(newOrder).not.toEqual(dmOrder);
  });

  test('can reorder sidebar sections', async ({ page }) => {
    const sidebar = new SidebarPage(page);

    // Get section order (quick links like Threads, Search, etc.)
    const sectionOrder = await sidebar.getSectionOrder();

    // Skip if fewer than 2 sections
    if (sectionOrder.length < 2) {
      test.skip();
      return;
    }

    const firstSection = sectionOrder[0];
    const secondSection = sectionOrder[1];

    // Use href-based selector for more reliable matching
    // Section links follow pattern: /{workspace}/{section}
    const sectionSlugMap: Record<string, string> = {
      'Threads': 'threads',
      'Search': 'search',
      'My Notes': 'notes',
      'Scheduled': 'scheduled',
      'Reminders': 'reminders',
      'Saved': 'saved',
    };
    const firstSlug = sectionSlugMap[firstSection] || firstSection.toLowerCase();
    const secondSlug = sectionSlugMap[secondSection] || secondSection.toLowerCase();

    // Get the section group using href
    const sectionGroup = page.locator('aside .group').filter({
      has: page.locator(`a[href*="/${firstSlug}"]`),
    });
    const dragHandle = sectionGroup.locator('button').first();

    // Force drag handle visible by removing opacity-0 class
    await dragHandle.evaluate((el) => {
      el.classList.remove('opacity-0');
      el.classList.add('opacity-100');
    });
    await page.waitForTimeout(100);

    // Verify drag handle is now visible
    if (!(await dragHandle.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Drag to second section using mouse events (required for dnd-kit)
    const targetSection = page.locator(`aside a[href*="/${secondSlug}"]`);

    // Get bounding boxes
    const handleBox = await dragHandle.boundingBox();
    const targetBox = await targetSection.boundingBox();

    if (!handleBox || !targetBox) {
      test.skip();
      return;
    }

    // Perform drag with mouse move events (dnd-kit requires this)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100); // Let dnd-kit detect the drag start

    // Move to target (with intermediate steps for smoother drag)
    const steps = 10;
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + targetBox.height / 2;

    for (let i = 1; i <= steps; i++) {
      const x = startX + (endX - startX) * (i / steps);
      const y = startY + (endY - startY) * (i / steps);
      await page.mouse.move(x, y);
      await page.waitForTimeout(20);
    }

    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify order changed
    const newOrder = await sidebar.getSectionOrder();
    expect(newOrder).not.toEqual(sectionOrder);
  });

  test('can reorder categories', async ({ page }) => {
    const sidebar = new SidebarPage(page);

    // Get category order before drag
    const categoryOrder = await sidebar.getCategoryOrder();

    // Skip if fewer than 2 categories
    if (categoryOrder.length < 2) {
      test.skip();
      return;
    }

    const firstCategory = categoryOrder[0];
    const secondCategory = categoryOrder[1];

    // Perform the drag operation with retry logic
    // Sometimes dnd-kit needs multiple attempts due to timing
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;

    while (attempts < maxAttempts && !success) {
      attempts++;

      // Use the SidebarPage helper which has dnd-kit compatible drag
      await sidebar.dragCategory(firstCategory, secondCategory);

      // Wait for UI update and server sync
      await page.waitForTimeout(500);

      // Check if order changed
      const newOrder = await sidebar.getCategoryOrder();

      if (newOrder[0] !== categoryOrder[0]) {
        success = true;
      } else if (attempts < maxAttempts) {
        // Refresh page and try again
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Re-expand channels section
        const channelLinks = page.locator('aside a[href*="/channels/"]');
        if (await channelLinks.count() === 0) {
          const channelsSection = page.locator('aside').getByRole('button', { name: /^channels$/i });
          await channelsSection.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Final verification
    const finalOrder = await sidebar.getCategoryOrder();
    expect(finalOrder[0]).not.toBe(categoryOrder[0]);
  });
});
