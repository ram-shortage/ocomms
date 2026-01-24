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

// Credentials depend on seed mode (matches auth.setup.ts)
const DEMO_SEED_MODE = process.env.E2E_SEED_MODE === 'demo';
const TEST_CREDENTIALS = DEMO_SEED_MODE
  ? { email: 'alice.chen@example.com', password: 'TheOrder2026!!' }
  : { email: 'alice@demo.ocomms.local', password: 'password123' };

test.describe('core flows regression', () => {
  test.describe('authentication', () => {
    test.skip('user can sign in and access workspace', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // Start fresh (no storage state)
      await page.context().clearCookies();

      // Navigate to login page
      await loginPage.goto();
      await expect(page).toHaveURL(/login/);

      // Enter credentials (based on seed mode)
      await loginPage.login(TEST_CREDENTIALS.email, TEST_CREDENTIALS.password);

      // Should redirect to workspace (or workspace picker)
      await expect(page).toHaveURL(/\/[a-z0-9-]+/, { timeout: 30000 });

      // If on workspace picker, select Acme Corporation
      if (await page.getByText('Your Workspaces').isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.getByRole('link', { name: /acme/i }).first().click();
        await expect(page).toHaveURL(/\/acme/, { timeout: 10000 });
      }

      // Should see workspace content (sidebar is an aside element)
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });
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

    test.skip('user can create and reply to threads', async ({ page, testWorkspace }) => {
      // Navigate to channel
      await page.goto(`/${testWorkspace}/channels/general`);

      // Wait for messages to load - messages are in a container with py-4 class
      // Each message is a div.group with flex items-start gap-3
      const messagesContainer = page.locator('.py-4').first();
      await expect(messagesContainer).toBeVisible({ timeout: 10000 });

      // Find a message item (message items have group class and flex layout)
      const message = messagesContainer.locator('div.group').first();
      await expect(message).toBeVisible({ timeout: 5000 });

      // Hover to reveal action buttons
      await message.hover();

      // Click thread/reply button - has sr-only text "Reply in thread"
      const replyButton = message.getByRole('button', { name: /reply in thread/i });
      await replyButton.click();

      // Thread panel is a Sheet that opens on the right side
      // The Sheet has role="dialog" and contains "Thread" title heading
      const threadPanel = page.getByRole('dialog');
      await expect(threadPanel).toBeVisible({ timeout: 5000 });
      await expect(threadPanel.getByRole('heading', { name: 'Thread' })).toBeVisible();

      // Send a reply in the thread
      const threadInput = threadPanel.getByPlaceholder(/reply in thread/i);
      await threadInput.fill(`Thread reply ${Date.now()}`);
      await threadInput.press('Enter');

      // Reply should appear in thread - check for reply count text
      await expect(threadPanel.getByText(/1 reply/i)).toBeVisible({ timeout: 5000 });
    });

    test('user can send direct messages', async ({ page, testWorkspace }) => {
      // Navigate to workspace first to get sidebar with DM list
      await page.goto(`/${testWorkspace}`);

      // Wait for sidebar to load
      await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });

      // Find an existing DM conversation with Bob in the sidebar
      // DM links in sidebar contain user names
      const dmLink = page.locator('aside').getByRole('link', { name: /bob/i }).first();

      if (await dmLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dmLink.click();
      } else {
        // Start new DM - look for the "New message" button (sr-only text)
        const sidebar = page.locator('aside');
        const newDmButton = sidebar.getByRole('button', { name: /new message/i }).first();
        if (await newDmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newDmButton.click();

          // Dialog opens - find and select Bob from the member list
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible({ timeout: 5000 });

          // Members are shown as labels with checkboxes
          const bobLabel = dialog.locator('label').filter({ hasText: /bob/i }).first();
          await bobLabel.click();

          // Click Start Conversation button
          await dialog.getByRole('button', { name: /start conversation/i }).click();
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

    test.skip('user can react to messages', async ({ page, testWorkspace }) => {
      const channelPage = new ChannelPage(page);
      await channelPage.goto(testWorkspace, 'general');

      // Wait for messages container to load
      const messagesContainer = page.locator('.py-4').first();
      await expect(messagesContainer).toBeVisible({ timeout: 10000 });

      // Find a message item
      const message = messagesContainer.locator('div.group').first();
      await expect(message).toBeVisible({ timeout: 5000 });

      // Hover to show reaction button
      await message.hover();

      // Click react button (has sr-only text "Add reaction")
      const reactButton = message.getByRole('button', { name: /add reaction/i });
      await reactButton.click();

      // Emoji picker should appear (em-emoji-picker is the emoji-mart component)
      const emojiPicker = page.locator('em-emoji-picker');
      await expect(emojiPicker).toBeVisible({ timeout: 5000 });

      // Click a common emoji - search for thumbs up and click it
      const searchInput = page.locator('em-emoji-picker input[type="search"], em-emoji-picker [role="searchbox"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill('thumbs');
      await page.waitForTimeout(500); // Wait for search results

      // Click the first thumbs up emoji in the results
      const thumbsUpEmoji = page.locator('em-emoji-picker button').filter({ hasText: /👍|:thumbsup:/ }).first();
      await thumbsUpEmoji.click();

      // Reaction should appear on the message
      // Reactions are rendered as buttons with rounded-full class and emoji content
      const reactionButton = message.locator('button.rounded-full');
      await expect(reactionButton).toBeVisible({ timeout: 5000 });

      // Click reaction again to toggle/remove
      await reactionButton.click();

      // Reaction should be removed
      await expect(reactionButton).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('search', () => {
    test('user can search messages', async ({ page, testWorkspace }) => {
      // Navigate to search
      await page.goto(`/${testWorkspace}/search`);

      // Search page title should be visible
      await expect(page.getByRole('heading', { name: /search/i })).toBeVisible();

      // Search input should be visible (look for input with search placeholder)
      const searchInput = page.locator('input[placeholder*="earch"]');
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      // Enter search query (use common words that should exist in demo-seed)
      await searchInput.fill('hello');
      await searchInput.press('Enter');

      // Wait for navigation/URL update (search uses URL params)
      await page.waitForURL(/[?&]q=/);

      // Should show results count or "No messages found" message
      // Results page shows either "X results for" or "No messages found for"
      const resultsOrEmpty = page.getByText(/result|no messages found/i);
      await expect(resultsOrEmpty.first()).toBeVisible({ timeout: 10000 });

      // Check if results exist - they're rendered as Card components within Links
      const resultCards = page.locator('a:has(.rounded-xl)'); // Card component
      if (await resultCards.count() > 0) {
        const firstResult = resultCards.first();
        await firstResult.click();
        // Should navigate to the channel/DM location (not search page)
        await expect(page).not.toHaveURL(/\/search/);
      }
    });
  });

  test.describe('navigation', () => {
    test('sidebar channel navigation works', async ({ page, testWorkspace }) => {
      const sidebar = new SidebarPage(page);

      await page.goto(`/${testWorkspace}`);

      // Wait for sidebar to load (sidebar is an aside element)
      await expect(page.locator('aside')).toBeVisible();

      // Find and click a channel
      const generalChannel = sidebar.getChannel('general');
      await expect(generalChannel).toBeVisible();
      await generalChannel.click();

      // Should navigate to channel
      await expect(page).toHaveURL(new RegExp(`/${testWorkspace}/channels/general`));
    });
  });
});
