import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for channel views.
 * Provides methods for messaging and channel interaction.
 */
export class ChannelPage {
  readonly page: Page;

  // Locators
  readonly messageInput: Locator;
  readonly messageList: Locator;
  readonly sendButton: Locator;
  readonly channelHeader: Locator;
  readonly typingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageInput = page.getByPlaceholder(/message/i);
    // Message list is a container div, not a semantic list element
    this.messageList = page.locator('.py-4').first();
    this.sendButton = page.getByRole('button', { name: /send/i });
    // Channel header is within header > div > div structure
    this.channelHeader = page.locator('header h1');
    this.typingIndicator = page.locator('[data-testid="typing-indicator"]');
  }

  /**
   * Navigate to a specific channel.
   */
  async goto(workspace: string, channel: string) {
    await this.page.goto(`/${workspace}/channels/${channel}`);
  }

  /**
   * Send a message in the current channel.
   */
  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    // Press Enter to send (most common way)
    await this.messageInput.press('Enter');
  }

  /**
   * Assert that a message is visible in the message list.
   */
  async expectMessageVisible(text: string, timeout?: number) {
    const options = timeout ? { timeout } : undefined;
    await expect(
      this.page.getByText(text, { exact: false })
    ).toBeVisible(options);
  }

  /**
   * Assert the channel header shows the expected channel name.
   */
  async expectChannelName(name: string) {
    await expect(this.channelHeader).toContainText(name);
  }

  /**
   * Get a message element by its text content.
   * Messages are div.group elements within the .py-4 container
   */
  getMessage(text: string) {
    return this.messageList.locator('div.group').filter({ hasText: text });
  }

  /**
   * Add a reaction to a message.
   */
  async addReaction(messageText: string, emoji: string) {
    const message = this.getMessage(messageText);
    await message.hover();
    // Reaction button has sr-only text "Add reaction"
    const reactionButton = message.getByRole('button', { name: /add reaction/i });
    await reactionButton.click();
    // Click the emoji in the picker (emoji-mart)
    await this.page.locator('em-emoji-picker button').filter({ hasText: emoji }).first().click();
  }

  /**
   * Wait for typing indicator to appear.
   */
  async expectTypingIndicator(userName: string) {
    await expect(this.typingIndicator).toContainText(userName);
  }
}
