import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for mobile navigation.
 * Provides methods for interacting with the mobile bottom tab bar and More menu.
 */
export class MobileNavPage {
  readonly page: Page;

  // Main navigation locators
  readonly bottomTabBar: Locator;
  readonly mobileOverflowMenu: Locator;

  // Tab locators
  readonly homeTab: Locator;
  readonly dmTab: Locator;
  readonly mentionsTab: Locator;
  readonly searchTab: Locator;
  readonly moreButton: Locator;

  // More menu drawer locators
  readonly moreMenuDrawer: Locator;
  readonly scheduledMessagesLink: Locator;
  readonly remindersLink: Locator;
  readonly savedItemsLink: Locator;
  readonly notesLink: Locator;
  readonly settingsLink: Locator;
  readonly profileLink: Locator;
  readonly statusButton: Locator;

  // Desktop sidebar (to verify it's NOT visible on mobile)
  readonly desktopSidebar: Locator;

  constructor(page: Page) {
    this.page = page;

    // Bottom tab bar - the nav element that's fixed at bottom
    this.bottomTabBar = page.locator('nav.fixed.bottom-0');
    this.mobileOverflowMenu = page.locator('[data-testid="mobile-overflow-menu"]');

    // Tab buttons - use link text and icons
    this.homeTab = this.bottomTabBar.getByRole('link', { name: /home/i });
    this.dmTab = this.bottomTabBar.getByRole('link', { name: /dms/i });
    this.mentionsTab = this.bottomTabBar.getByRole('link', { name: /mentions/i });
    this.searchTab = this.bottomTabBar.getByRole('link', { name: /search/i });
    this.moreButton = this.bottomTabBar.getByRole('button', { name: /more/i });

    // More menu drawer content
    this.moreMenuDrawer = page.locator('[vaul-drawer-content]');
    this.scheduledMessagesLink = page.getByRole('link', { name: /scheduled messages/i });
    this.remindersLink = page.getByRole('link', { name: /reminders/i });
    this.savedItemsLink = page.getByRole('link', { name: /saved items/i });
    this.notesLink = page.getByRole('link', { name: /my notes/i });
    this.settingsLink = page.getByRole('link', { name: /^settings$/i });
    this.profileLink = page.getByRole('link', { name: /^profile$/i });
    this.statusButton = page.getByRole('button', { name: /set status/i });

    // Desktop sidebar - should not be visible on mobile
    this.desktopSidebar = page.locator('[data-testid="sidebar"]');
  }

  /**
   * Navigate to a workspace on mobile.
   */
  async goto(workspaceSlug: string) {
    await this.page.goto(`/${workspaceSlug}`);
    await this.expectBottomTabBarVisible();
  }

  /**
   * Open the More menu drawer.
   */
  async openMoreMenu() {
    await this.moreButton.click();
    await expect(this.moreMenuDrawer).toBeVisible();
  }

  /**
   * Close the More menu drawer.
   */
  async closeMoreMenu() {
    // Click outside the drawer or drag it down
    await this.page.keyboard.press('Escape');
    await expect(this.moreMenuDrawer).not.toBeVisible();
  }

  /**
   * Navigate to a tab.
   */
  async navigateToTab(tab: 'home' | 'dms' | 'mentions' | 'search') {
    const tabLocator = {
      home: this.homeTab,
      dms: this.dmTab,
      mentions: this.mentionsTab,
      search: this.searchTab,
    }[tab];
    await tabLocator.click();
  }

  /**
   * Navigate to a More menu item.
   */
  async navigateToMoreItem(item: 'scheduled' | 'reminders' | 'saved' | 'notes' | 'settings' | 'profile') {
    await this.openMoreMenu();
    const linkLocator = {
      scheduled: this.scheduledMessagesLink,
      reminders: this.remindersLink,
      saved: this.savedItemsLink,
      notes: this.notesLink,
      settings: this.settingsLink,
      profile: this.profileLink,
    }[item];
    await linkLocator.click();
  }

  /**
   * Get the currently active (highlighted) tab.
   */
  async getCurrentTab(): Promise<string | null> {
    // Check each tab for the active class (text-primary)
    const tabs = [
      { name: 'home', locator: this.homeTab },
      { name: 'dms', locator: this.dmTab },
      { name: 'mentions', locator: this.mentionsTab },
      { name: 'search', locator: this.searchTab },
    ];

    for (const { name, locator } of tabs) {
      const classes = await locator.getAttribute('class');
      if (classes?.includes('text-primary')) {
        return name;
      }
    }

    // Check if More button is active
    const moreClasses = await this.moreButton.getAttribute('class');
    if (moreClasses?.includes('text-primary')) {
      return 'more';
    }

    return null;
  }

  /**
   * Assert that the bottom tab bar is visible.
   */
  async expectBottomTabBarVisible() {
    await expect(this.bottomTabBar).toBeVisible();
  }

  /**
   * Assert that the desktop sidebar is NOT visible (mobile layout).
   */
  async expectDesktopSidebarNotVisible() {
    await expect(this.desktopSidebar).not.toBeVisible();
  }

  /**
   * Assert that a specific tab is highlighted as active.
   */
  async expectTabActive(tab: 'home' | 'dms' | 'mentions' | 'search' | 'more') {
    const locator = {
      home: this.homeTab,
      dms: this.dmTab,
      mentions: this.mentionsTab,
      search: this.searchTab,
      more: this.moreButton,
    }[tab];

    // The active tab has text-primary class
    await expect(locator).toHaveClass(/text-primary/);
  }

  /**
   * Assert that a specific tab is NOT highlighted.
   */
  async expectTabInactive(tab: 'home' | 'dms' | 'mentions' | 'search' | 'more') {
    const locator = {
      home: this.homeTab,
      dms: this.dmTab,
      mentions: this.mentionsTab,
      search: this.searchTab,
      more: this.moreButton,
    }[tab];

    // Inactive tabs have text-muted-foreground class
    await expect(locator).toHaveClass(/text-muted-foreground/);
  }

  /**
   * Check if the More menu drawer is visible.
   */
  async isMoreMenuOpen(): Promise<boolean> {
    return await this.moreMenuDrawer.isVisible();
  }
}
