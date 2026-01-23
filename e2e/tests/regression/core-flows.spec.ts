import { test, expect } from '../../fixtures/test-fixtures';
import { ChannelPage } from '../../pages/channel.page';
import { LoginPage } from '../../pages/login.page';
import { SidebarPage } from '../../pages/sidebar.page';

/**
 * Core Flows Regression Tests
 *
 * Verifies that v0.5.0 core functionality still works correctly.
 * These tests ensure no regressions in messaging, threading, DMs,
 * reactions, and search.
 */

test.describe('core flows regression', () => {
  test.describe('authentication', () => {
    test('user can sign in and access workspace', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // Start fresh (no storage state)
      await page.context().clearCookies();

      // Navigate to sign-in
      await loginPage.goto();
      await expect(page).toHaveURL(/sign-in/);

      // Enter credentials
      await loginPage.login('alice@demo.ocomms.local', 'password123');

      // Should redirect to workspace (or workspace picker)
      await expect(page).toHaveURL(/\/[a-z0-9-]+/, { timeout: 30000 });

      // Should see workspace content (sidebar with nav)
      await expect(page.locator('nav')).toBeVisible();
    });
  });

  test.describe('messaging', () => {
    let channelPage: ChannelPage;

    test.beforeEach(async ({ page }) => {
      channelPage = new ChannelPage(page);
    });

    test('user can send and receive messages', async ({ testWorkspace }) => {
      // Navigate to general channel
      await channelPage.goto(testWorkspace, 'general');
      await channelPage.expectChannelName('general');

      // Generate unique message to avoid collision
      const uniqueMessage = `Test message ${Date.now()}`;

      // Send message
      await channelPage.sendMessage(uniqueMessage);

      // Verify message appears in list
      await channelPage.expectMessageVisible(uniqueMessage);

      // Refresh page to verify persistence
      await channelPage.page.reload();
      await channelPage.expectMessageVisible(uniqueMessage);
    });

    test('user can create and reply to threads', async ({ page, testWorkspace }) => {
      // Navigate to channel
      await page.goto(`/${testWorkspace}/channels/general`);

      // Wait for messages to load
      const messageList = page.getByRole('list', { name: /messages/i });
      await expect(messageList).toBeVisible();

      // Find a message with the thread reply button
      const message = page.locator('[data-message-id]').first();
      await expect(message).toBeVisible();

      // Hover to reveal action buttons
      await message.hover();

      // Click thread/reply button
      const replyButton = message.getByRole('button', { name: /thread|reply/i });
      await replyButton.click();

      // Thread panel should open
      const threadPanel = page.locator('[data-testid="thread-panel"]');
      await expect(threadPanel).toBeVisible();

      // Send a reply in the thread
      const threadInput = threadPanel.getByPlaceholder(/reply/i);
      await threadInput.fill(`Thread reply ${Date.now()}`);
      await threadInput.press('Enter');

      // Reply should appear in thread
      await expect(threadPanel.locator('[data-message-id]')).toHaveCount(2, { timeout: 5000 });
    });

    test('user can send direct messages', async ({ page, testWorkspace }) => {
      // Navigate to DMs
      await page.goto(`/${testWorkspace}/dm`);

      // Find or start a DM conversation
      // Look for existing DM or start new one
      const dmLink = page.getByRole('link', { name: /bob/i }).first();

      if (await dmLink.isVisible()) {
        await dmLink.click();
      } else {
        // Start new DM - click the "New message" or "+" button
        const newDmButton = page.getByRole('button', { name: /new message|start|compose/i });
        if (await newDmButton.isVisible()) {
          await newDmButton.click();
          // Select Bob from the list
          const userSelect = page.getByRole('option', { name: /bob/i });
          await userSelect.click();
        }
      }

      // Wait for DM conversation to load
      const messageInput = page.getByPlaceholder(/message/i);
      await expect(messageInput).toBeVisible({ timeout: 10000 });

      // Send a message
      const dmMessage = `DM test ${Date.now()}`;
      await messageInput.fill(dmMessage);
      await messageInput.press('Enter');

      // Verify message appears
      await expect(page.getByText(dmMessage)).toBeVisible({ timeout: 5000 });
    });

    test('user can react to messages', async ({ page, testWorkspace }) => {
      const channelPage = new ChannelPage(page);
      await channelPage.goto(testWorkspace, 'general');

      // Find a message
      const message = page.locator('[data-message-id]').first();
      await expect(message).toBeVisible();

      // Hover to show reaction button
      await message.hover();

      // Click react button
      const reactButton = message.getByRole('button', { name: /react|emoji/i });
      await reactButton.click();

      // Emoji picker should appear
      const emojiPicker = page.locator('em-emoji-picker, [data-testid="emoji-picker"]');
      await expect(emojiPicker).toBeVisible();

      // Click a common emoji (thumbs up)
      // emoji-mart structure: look for the frequently used or search
      const thumbsUp = page.locator('[data-emoji-set] button[aria-label*="thumbs"], [title*="thumbs"]').first();
      if (await thumbsUp.isVisible()) {
        await thumbsUp.click();
      } else {
        // Try clicking first emoji in the grid
        const firstEmoji = page.locator('em-emoji-picker button').first();
        await firstEmoji.click();
      }

      // Reaction should appear on the message
      const reaction = message.locator('[data-testid="reaction"]');
      await expect(reaction).toBeVisible({ timeout: 5000 });

      // Click reaction again to toggle/remove
      await reaction.click();

      // Reaction should be removed or count decreased
      await expect(reaction).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('search', () => {
    test('user can search messages', async ({ page, testWorkspace }) => {
      // Navigate to search
      await page.goto(`/${testWorkspace}/search`);

      // Search input should be visible
      const searchInput = page.getByPlaceholder(/search/i);
      await expect(searchInput).toBeVisible();

      // Enter search query (use a common word that should exist)
      await searchInput.fill('test');
      await searchInput.press('Enter');

      // Wait for results (or "no results" message)
      await page.waitForLoadState('networkidle');

      // Should show results section or empty state
      const resultsOrEmpty = page.getByText(/result|found|no.*match/i);
      await expect(resultsOrEmpty.first()).toBeVisible({ timeout: 10000 });

      // If results exist, clicking one should navigate
      const result = page.locator('[data-testid="search-result"], [class*="search-result"]').first();
      if (await result.isVisible()) {
        await result.click();
        // Should navigate to the message location
        await expect(page).not.toHaveURL(/\/search$/);
      }
    });
  });

  test.describe('navigation', () => {
    test('sidebar channel navigation works', async ({ page, testWorkspace }) => {
      const sidebar = new SidebarPage(page);

      await page.goto(`/${testWorkspace}`);

      // Wait for sidebar to load
      await expect(page.locator('nav')).toBeVisible();

      // Find and click a channel
      const generalChannel = sidebar.getChannel('general');
      await expect(generalChannel).toBeVisible();
      await generalChannel.click();

      // Should navigate to channel
      await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/channels/general`));
    });
  });
});
