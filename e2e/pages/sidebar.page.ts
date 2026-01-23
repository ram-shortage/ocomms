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

  // ============================================
  // DRAG AND DROP HELPERS (Plan 36-03)
  // ============================================

  /**
   * Get all category headers in the sidebar.
   * Categories are identified by uppercase text with chevron icons.
   */
  getCategoryHeaders() {
    return this.page.locator('aside button').filter({
      has: this.page.locator('text=/^[A-Z\\s]+$/'),
    });
  }

  /**
   * Get a category header by name (case insensitive).
   */
  getCategoryHeader(name: string) {
    return this.page.locator('aside').getByRole('button', {
      name: new RegExp(name, 'i'),
    });
  }

  /**
   * Get the drag handle for a category.
   * The drag handle appears on hover next to category headers.
   */
  getCategoryDragHandle(categoryName: string) {
    // The category has a parent group with drag handle
    const categoryGroup = this.page.locator('aside .group').filter({
      has: this.page.getByRole('button', { name: new RegExp(categoryName, 'i') }),
    });
    return categoryGroup.locator('button').first(); // Drag handle is the first button
  }

  /**
   * Get the drag handle for a channel.
   */
  getChannelDragHandle(channelName: string) {
    const channelGroup = this.page.locator('aside .group').filter({
      has: this.page.getByRole('link', { name: new RegExp(`#\\s*${channelName}`, 'i') }),
    });
    return channelGroup.locator('button').first();
  }

  /**
   * Get the drag handle for a DM conversation.
   */
  getDmDragHandle(userName: string) {
    const dmGroup = this.page.locator('aside .group').filter({
      has: this.page.getByRole('link', { name: new RegExp(userName, 'i') }),
    });
    return dmGroup.locator('button').first();
  }

  /**
   * Get the drag handle for a sidebar section (Channels, Direct Messages, etc.).
   */
  getSectionDragHandle(sectionName: string) {
    const sectionGroup = this.page.locator('aside .group').filter({
      has: this.page.getByRole('button', { name: new RegExp(sectionName, 'i') }),
    });
    return sectionGroup.locator('button').first();
  }

  /**
   * Get the order of categories in the sidebar.
   * @returns Array of category names in their display order.
   */
  async getCategoryOrder(): Promise<string[]> {
    // Categories are uppercase buttons with chevrons
    const categoryButtons = this.page.locator('aside button').filter({
      hasText: /^[A-Z][A-Z\s]*$/,
    });

    const count = await categoryButtons.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await categoryButtons.nth(i).textContent();
      if (text) {
        // Clean up text (remove chevron markers, trim)
        const name = text.trim();
        if (name && !name.includes('CHANNELS') && !name.includes('DIRECT')) {
          names.push(name);
        }
      }
    }

    return names;
  }

  /**
   * Get the order of channels within a category or uncategorized.
   * @param categoryName - Category name or 'uncategorized' for channels without a category.
   * @returns Array of channel names in their display order.
   */
  async getChannelOrder(categoryName?: string): Promise<string[]> {
    // Get channel links in sidebar
    const channelLinks = this.page.locator('aside a[href*="/channels/"]');
    const count = await channelLinks.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await channelLinks.nth(i).textContent();
      if (text) {
        // Channel names have # prefix
        const name = text.replace(/^#\s*/, '').trim();
        if (name) {
          names.push(name);
        }
      }
    }

    return names;
  }

  /**
   * Get the order of DM conversations.
   * @returns Array of user display names in their display order.
   */
  async getDMOrder(): Promise<string[]> {
    // DMs are links in the Direct Messages section
    // They have user names/emails as text
    const dmSection = this.page.locator('aside').getByRole('button', { name: /direct messages/i });

    // Get the next sibling container with DM links
    // DMs are within the same parent section
    const dmLinks = this.page.locator('aside a[href*="/dm/"]');
    const count = await dmLinks.count();
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await dmLinks.nth(i).textContent();
      if (text) {
        names.push(text.trim());
      }
    }

    return names;
  }

  /**
   * Get the order of sidebar sections (Quick links).
   * @returns Array of section names in their display order.
   */
  async getSectionOrder(): Promise<string[]> {
    // Quick links section includes: Threads, Search, Notes, Scheduled, Reminders, Saved
    const quickLinkNames = ['Threads', 'Search', 'My Notes', 'Scheduled', 'Reminders', 'Saved'];
    const foundNames: string[] = [];

    for (const name of quickLinkNames) {
      const link = this.page.locator('aside').getByRole('link', { name: new RegExp(`^${name}$`, 'i') });
      if (await link.isVisible()) {
        foundNames.push(name);
      }
    }

    // Return in the order they appear in the sidebar
    const allLinks = this.page.locator('aside a').filter({
      has: this.page.locator('svg'), // Quick links have icons
    });

    const count = await allLinks.count();
    const orderedNames: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await allLinks.nth(i).textContent();
      if (text) {
        const name = text.trim();
        if (quickLinkNames.some((qn) => qn.toLowerCase() === name.toLowerCase())) {
          orderedNames.push(name);
        }
      }
    }

    return orderedNames;
  }

  /**
   * Get the order of main sections (Channels, Direct Messages, Archived).
   * @returns Array of main section names in their display order.
   */
  async getMainSectionOrder(): Promise<string[]> {
    const mainSections = ['Channels', 'Direct Messages', 'Archived'];
    const orderedNames: string[] = [];

    // Get all section headers in order
    const sectionButtons = this.page.locator('aside button').filter({
      hasText: new RegExp(`(${mainSections.join('|')})`, 'i'),
    });

    const count = await sectionButtons.count();

    for (let i = 0; i < count; i++) {
      const text = await sectionButtons.nth(i).textContent();
      if (text) {
        const name = text.trim().toUpperCase();
        if (name.includes('CHANNEL')) orderedNames.push('Channels');
        else if (name.includes('DIRECT')) orderedNames.push('Direct Messages');
        else if (name.includes('ARCHIVED')) orderedNames.push('Archived');
      }
    }

    return orderedNames;
  }

  /**
   * Drag a category to a new position.
   * Uses dnd-kit compatible drag operations.
   */
  async dragCategory(fromCategory: string, toCategory: string) {
    // Hover to reveal drag handle
    const fromHeader = this.getCategoryHeader(fromCategory);
    await fromHeader.hover();

    // Get the drag handle
    const fromGroup = this.page.locator('aside .group').filter({
      has: fromHeader,
    });
    const dragHandle = fromGroup.locator('button').first();

    // Get target position
    const toHeader = this.getCategoryHeader(toCategory);

    // Perform drag
    await dragHandle.dragTo(toHeader);

    // Small delay for UI update
    await this.page.waitForTimeout(300);
  }

  /**
   * Drag a channel to a new position (within same category or to another category).
   */
  async dragChannelTo(channelName: string, targetElement: Locator) {
    // Hover to reveal drag handle
    const channel = this.getChannel(channelName);
    await channel.hover();

    // Get parent group and drag handle
    const channelGroup = this.page.locator('aside .group').filter({
      has: channel,
    });
    const dragHandle = channelGroup.locator('button').first();

    // Perform drag
    await dragHandle.dragTo(targetElement);

    // Small delay for UI update
    await this.page.waitForTimeout(300);
  }

  /**
   * Drag a channel to another channel's position (reorder within category).
   */
  async dragChannelToChannel(fromChannel: string, toChannel: string) {
    const target = this.getChannel(toChannel);
    await this.dragChannelTo(fromChannel, target);
  }

  /**
   * Drag a channel to a category header (move to different category).
   */
  async dragChannelToCategory(channelName: string, categoryName: string) {
    const target = this.getCategoryHeader(categoryName);
    await this.dragChannelTo(channelName, target);
  }

  /**
   * Drag a DM to a new position.
   */
  async dragDm(fromUser: string, toUser: string) {
    // Hover to reveal drag handle
    const fromDm = this.page.locator('aside a[href*="/dm/"]').filter({
      hasText: new RegExp(fromUser, 'i'),
    });
    await fromDm.hover();

    // Get parent group and drag handle
    const dmGroup = this.page.locator('aside .group').filter({
      has: fromDm,
    });
    const dragHandle = dmGroup.locator('button').first();

    // Get target
    const toDm = this.page.locator('aside a[href*="/dm/"]').filter({
      hasText: new RegExp(toUser, 'i'),
    });

    // Perform drag
    await dragHandle.dragTo(toDm);

    // Small delay for UI update
    await this.page.waitForTimeout(300);
  }

  /**
   * Drag a sidebar section to a new position.
   */
  async dragSection(fromSection: string, toSection: string) {
    // Hover to reveal drag handle
    const fromLink = this.page.locator('aside').getByRole('link', {
      name: new RegExp(`^${fromSection}$`, 'i'),
    });
    await fromLink.hover();

    // Get parent group and drag handle
    const sectionGroup = this.page.locator('aside .group').filter({
      has: fromLink,
    });
    const dragHandle = sectionGroup.locator('button').first();

    // Get target
    const toLink = this.page.locator('aside').getByRole('link', {
      name: new RegExp(`^${toSection}$`, 'i'),
    });

    // Perform drag
    await dragHandle.dragTo(toLink);

    // Small delay for UI update
    await this.page.waitForTimeout(300);
  }

  /**
   * Drag a main section (Channels, DMs, Archived) to a new position.
   */
  async dragMainSection(fromSection: string, toSection: string) {
    // Get section header buttons
    const fromButton = this.page.locator('aside').getByRole('button', {
      name: new RegExp(fromSection, 'i'),
    });
    await fromButton.hover();

    // Get parent group and drag handle
    const sectionGroup = fromButton.locator('..').locator('..');
    const dragHandle = sectionGroup.locator('button').first();

    // Get target
    const toButton = this.page.locator('aside').getByRole('button', {
      name: new RegExp(toSection, 'i'),
    });

    // Perform drag
    await dragHandle.dragTo(toButton);

    // Small delay for UI update
    await this.page.waitForTimeout(300);
  }
}
