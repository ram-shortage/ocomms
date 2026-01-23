import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for the workspace switcher component.
 * Provides methods for switching workspaces and checking unread counts.
 */
export class WorkspaceSwitcherPage {
  readonly page: Page;

  // Locators
  readonly switcherButton: Locator;
  readonly switcherDropdown: Locator;
  readonly workspaceList: Locator;
  readonly createWorkspaceButton: Locator;
  readonly browseWorkspacesLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.switcherButton = page.getByRole('button', { name: /switch workspace/i });
    this.switcherDropdown = page.locator('[data-testid="workspace-switcher-dropdown"]');
    this.workspaceList = page.locator('[data-testid="workspace-list"]');
    this.createWorkspaceButton = page.getByRole('button', { name: /create workspace/i });
    this.browseWorkspacesLink = page.getByRole('link', { name: /browse workspaces/i });
  }

  /**
   * Open the workspace switcher dropdown.
   */
  async open() {
    await this.switcherButton.click();
    await expect(this.switcherDropdown).toBeVisible();
  }

  /**
   * Close the workspace switcher dropdown.
   */
  async close() {
    // Click outside to close
    await this.page.keyboard.press('Escape');
    await expect(this.switcherDropdown).toBeHidden();
  }

  /**
   * Get a workspace item by name.
   */
  getWorkspace(name: string) {
    return this.workspaceList.getByRole('button', { name: new RegExp(name, 'i') });
  }

  /**
   * Select a workspace from the dropdown.
   */
  async selectWorkspace(name: string) {
    await this.open();
    await this.getWorkspace(name).click();
    // Wait for navigation to complete
    await this.page.waitForURL(new RegExp(`/${name.toLowerCase().replace(/\s+/g, '-')}`));
  }

  /**
   * Get the unread count for a specific workspace.
   * Returns 0 if no unread badge is visible.
   */
  async getUnreadCount(workspaceName: string): Promise<number> {
    await this.open();
    const workspace = this.getWorkspace(workspaceName);
    const badge = workspace.locator('[data-testid="unread-badge"]');

    const isVisible = await badge.isVisible();
    if (!isVisible) {
      await this.close();
      return 0;
    }

    const text = await badge.textContent();
    await this.close();
    return parseInt(text || '0', 10);
  }

  /**
   * Assert that a workspace is in the list.
   */
  async expectWorkspaceVisible(name: string) {
    await this.open();
    await expect(this.getWorkspace(name)).toBeVisible();
    await this.close();
  }

  /**
   * Assert that a workspace has a specific unread count.
   */
  async expectUnreadCount(workspaceName: string, count: number) {
    const actual = await this.getUnreadCount(workspaceName);
    expect(actual).toBe(count);
  }

  /**
   * Navigate to create a new workspace.
   */
  async clickCreateWorkspace() {
    await this.open();
    await this.createWorkspaceButton.click();
  }

  /**
   * Navigate to browse workspaces.
   */
  async clickBrowseWorkspaces() {
    await this.open();
    await this.browseWorkspacesLink.click();
  }
}
