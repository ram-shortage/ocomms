import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for the sidebar navigation.
 * Provides methods for channel/category navigation and drag-drop operations.
 */
export class SidebarPage {
  readonly page: Page;

  // Locators
  readonly sidebar: Locator;
  readonly categoryList: Locator;
  readonly channelList: Locator;
  readonly dmList: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('[data-testid="sidebar"]');
    this.categoryList = page.locator('[data-testid="category-list"]');
    this.channelList = page.locator('[data-testid="channel-list"]');
    this.dmList = page.locator('[data-testid="dm-list"]');
    this.searchInput = page.getByPlaceholder(/search/i);
  }

  /**
   * Get a category section by name.
   */
  getCategory(name: string) {
    return this.page.locator('[data-testid="category"]').filter({ hasText: name });
  }

  /**
   * Get a channel item by name.
   */
  getChannel(name: string) {
    return this.page.getByRole('link', { name: new RegExp(`#\\s*${name}`, 'i') });
  }

  /**
   * Get a DM item by user name.
   */
  getDm(userName: string) {
    return this.dmList.getByRole('link', { name: new RegExp(userName, 'i') });
  }

  /**
   * Click on a channel to navigate to it.
   */
  async clickChannel(name: string) {
    await this.getChannel(name).click();
  }

  /**
   * Click on a DM to navigate to it.
   */
  async clickDm(userName: string) {
    await this.getDm(userName).click();
  }

  /**
   * Expand or collapse a category.
   */
  async toggleCategory(name: string) {
    const category = this.getCategory(name);
    const toggle = category.getByRole('button', { name: /toggle/i });
    await toggle.click();
  }

  /**
   * Drag a channel from one position to another.
   * This will be extended in Plan 03 for comprehensive drag-drop tests.
   */
  async dragChannel(fromChannel: string, toChannel: string) {
    const source = this.getChannel(fromChannel);
    const target = this.getChannel(toChannel);

    // Get the drag handle for the source channel
    const dragHandle = source.locator('[data-testid="drag-handle"]');

    // Perform drag and drop
    await dragHandle.dragTo(target);
  }

  /**
   * Assert that a channel is visible in the sidebar.
   */
  async expectChannelVisible(name: string) {
    await expect(this.getChannel(name)).toBeVisible();
  }

  /**
   * Assert that a channel has an unread indicator.
   */
  async expectChannelUnread(name: string) {
    const channel = this.getChannel(name);
    await expect(channel.locator('[data-testid="unread-indicator"]')).toBeVisible();
  }

  /**
   * Assert that the sidebar shows a specific number of channels.
   */
  async expectChannelCount(count: number) {
    await expect(this.page.locator('[data-testid="channel-item"]')).toHaveCount(count);
  }
}
