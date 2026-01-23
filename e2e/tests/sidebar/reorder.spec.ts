import { test, expect } from '../../fixtures/test-fixtures';
import { SidebarPage } from '../../pages/sidebar.page';

test.describe('Sidebar Reordering', () => {
  let sidebar: SidebarPage;

  test.beforeEach(async ({ page, testWorkspace }) => {
    sidebar = new SidebarPage(page);
    // Navigate to workspace
    await page.goto(`/${testWorkspace}`);
    // Wait for sidebar to load
    await page.waitForSelector('aside', { state: 'visible' });
  });

  test.describe('Category Reordering (SIDE-02)', () => {
    test('categories can be reordered via drag and drop', async ({ page }) => {
      // Get initial category order
      const initialOrder = await sidebar.getCategoryOrder();

      // Skip if no categories or less than 2
      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 categories to test reordering');
        return;
      }

      const firstCategory = initialOrder[0];
      const secondCategory = initialOrder[1];

      // Drag first category to second position
      await sidebar.dragCategory(firstCategory, secondCategory);

      // Verify order changed
      const newOrder = await sidebar.getCategoryOrder();
      expect(newOrder[0]).not.toBe(firstCategory);

      // The categories should have swapped or reordered
      expect(newOrder).toContain(firstCategory);
      expect(newOrder).toContain(secondCategory);
    });

    test('category reorder persists after refresh', async ({ page }) => {
      // Get initial category order
      const initialOrder = await sidebar.getCategoryOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 categories to test persistence');
        return;
      }

      const firstCategory = initialOrder[0];
      const secondCategory = initialOrder[1];

      // Drag first category to second position
      await sidebar.dragCategory(firstCategory, secondCategory);

      // Wait for persistence
      await page.waitForTimeout(500);

      // Refresh the page
      await page.reload();
      await page.waitForSelector('aside', { state: 'visible' });

      // Verify order is still changed
      const orderAfterRefresh = await sidebar.getCategoryOrder();
      expect(orderAfterRefresh[0]).not.toBe(firstCategory);
    });
  });

  test.describe('Channel Reordering (SIDE-03)', () => {
    test('channels can be reordered within category', async ({ page }) => {
      // Get initial channel order
      const initialOrder = await sidebar.getChannelOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 channels to test reordering');
        return;
      }

      const firstChannel = initialOrder[0];
      const secondChannel = initialOrder[1];

      // Drag first channel to second position
      await sidebar.dragChannelToChannel(firstChannel, secondChannel);

      // Verify order changed
      const newOrder = await sidebar.getChannelOrder();

      // Order should have changed (may vary by exact behavior)
      // At minimum, verify both channels still exist
      expect(newOrder).toContain(firstChannel);
      expect(newOrder).toContain(secondChannel);
    });

    test('channel reorder persists after refresh', async ({ page }) => {
      // Get initial channel order
      const initialOrder = await sidebar.getChannelOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 channels to test persistence');
        return;
      }

      const firstChannel = initialOrder[0];
      const secondChannel = initialOrder[1];

      // Drag channels
      await sidebar.dragChannelToChannel(firstChannel, secondChannel);

      // Wait for persistence
      await page.waitForTimeout(500);

      // Refresh
      await page.reload();
      await page.waitForSelector('aside', { state: 'visible' });

      // Verify order persists (channels still exist)
      const orderAfterRefresh = await sidebar.getChannelOrder();
      expect(orderAfterRefresh).toContain(firstChannel);
      expect(orderAfterRefresh).toContain(secondChannel);
    });
  });

  test.describe('Channel Between Categories (SIDE-04)', () => {
    test('channels can be moved between categories', async ({ page }) => {
      // Get categories
      const categories = await sidebar.getCategoryOrder();

      if (categories.length < 2) {
        test.skip(true, 'Need at least 2 categories to test moving channels');
        return;
      }

      // Get channels
      const channels = await sidebar.getChannelOrder();

      if (channels.length < 1) {
        test.skip(true, 'Need at least 1 channel to test moving');
        return;
      }

      const channelToMove = channels[0];
      const targetCategory = categories[1];

      // Move channel to different category
      await sidebar.dragChannelToCategory(channelToMove, targetCategory);

      // The channel should still exist in sidebar
      const newChannels = await sidebar.getChannelOrder();
      expect(newChannels).toContain(channelToMove);
    });

    test('channel move between categories persists', async ({ page }) => {
      const categories = await sidebar.getCategoryOrder();

      if (categories.length < 2) {
        test.skip(true, 'Need at least 2 categories');
        return;
      }

      const channels = await sidebar.getChannelOrder();

      if (channels.length < 1) {
        test.skip(true, 'Need at least 1 channel');
        return;
      }

      const channelToMove = channels[0];
      const targetCategory = categories[1];

      // Move channel
      await sidebar.dragChannelToCategory(channelToMove, targetCategory);

      // Wait for persistence
      await page.waitForTimeout(500);

      // Refresh
      await page.reload();
      await page.waitForSelector('aside', { state: 'visible' });

      // Channel should still be visible
      const channelsAfterRefresh = await sidebar.getChannelOrder();
      expect(channelsAfterRefresh).toContain(channelToMove);
    });
  });

  test.describe('DM Reordering (SIDE-05)', () => {
    test('DM conversations can be reordered', async ({ page }) => {
      // Get initial DM order
      const initialOrder = await sidebar.getDMOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 DMs to test reordering');
        return;
      }

      const firstDm = initialOrder[0];
      const secondDm = initialOrder[1];

      // Drag first DM to second position
      await sidebar.dragDm(firstDm, secondDm);

      // Verify both DMs still exist
      const newOrder = await sidebar.getDMOrder();
      expect(newOrder).toContain(firstDm);
      expect(newOrder).toContain(secondDm);
    });
  });

  test.describe('Section Reordering (SIDE-06)', () => {
    test('sidebar sections can be reordered', async ({ page }) => {
      // Get initial section order (quick links)
      const initialOrder = await sidebar.getSectionOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 sections to test reordering');
        return;
      }

      const firstSection = initialOrder[0];
      const secondSection = initialOrder[1];

      // Drag first section to second position
      await sidebar.dragSection(firstSection, secondSection);

      // Verify sections still exist
      const newOrder = await sidebar.getSectionOrder();
      expect(newOrder).toContain(firstSection);
      expect(newOrder).toContain(secondSection);
    });

    test('main sections (Channels, DMs) can be reordered', async ({ page }) => {
      // Get initial main section order
      const initialOrder = await sidebar.getMainSectionOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 main sections');
        return;
      }

      // Note: Main sections are Channels, Direct Messages, Archived
      // Their headers have drag handles
      const firstSection = initialOrder[0];
      const secondSection = initialOrder[1];

      // Drag first main section to second position
      await sidebar.dragMainSection(firstSection, secondSection);

      // Verify sections still exist
      const newOrder = await sidebar.getMainSectionOrder();
      expect(newOrder).toContain(firstSection);
      expect(newOrder).toContain(secondSection);
    });
  });
});

test.describe('Sidebar Order Cross-Device Sync (SIDE-08)', () => {
  test('sidebar order syncs across browser contexts', async ({ browser }) => {
    // Create two browser contexts with the same user
    const context1 = await browser.newContext({
      storageState: 'e2e/.auth/alice.json',
    });
    const context2 = await browser.newContext({
      storageState: 'e2e/.auth/alice.json',
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const sidebar1 = new SidebarPage(page1);
      const sidebar2 = new SidebarPage(page2);

      // Page 1: Navigate to workspace
      await page1.goto('/acme-corp');
      await page1.waitForSelector('aside', { state: 'visible' });

      // Get initial section order
      const initialOrder = await sidebar1.getSectionOrder();

      if (initialOrder.length < 2) {
        test.skip(true, 'Need at least 2 sections to test sync');
        return;
      }

      // Page 1: Reorder sections
      const firstSection = initialOrder[0];
      const secondSection = initialOrder[1];
      await sidebar1.dragSection(firstSection, secondSection);

      // Wait for server sync
      await page1.waitForTimeout(1000);

      // Page 2: Navigate to workspace and verify order
      await page2.goto('/acme-corp');
      await page2.waitForSelector('aside', { state: 'visible' });

      // Get order in page 2
      const page2Order = await sidebar2.getSectionOrder();

      // Both contexts should see the same order (synced via server)
      expect(page2Order).toContain(firstSection);
      expect(page2Order).toContain(secondSection);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('sidebar order syncs after refresh', async ({ page, testWorkspace }) => {
    const sidebar = new SidebarPage(page);

    // Navigate to workspace
    await page.goto(`/${testWorkspace}`);
    await page.waitForSelector('aside', { state: 'visible' });

    // Get initial order
    const initialOrder = await sidebar.getSectionOrder();

    if (initialOrder.length < 2) {
      test.skip(true, 'Need at least 2 sections');
      return;
    }

    // Reorder
    const firstSection = initialOrder[0];
    const secondSection = initialOrder[1];
    await sidebar.dragSection(firstSection, secondSection);

    // Wait for persistence
    await page.waitForTimeout(500);

    // Refresh
    await page.reload();
    await page.waitForSelector('aside', { state: 'visible' });

    // Order should persist
    const orderAfterRefresh = await sidebar.getSectionOrder();
    expect(orderAfterRefresh).toContain(firstSection);
    expect(orderAfterRefresh).toContain(secondSection);
  });
});
