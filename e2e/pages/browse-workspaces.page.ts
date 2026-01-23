import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for the browse workspaces page (/browse-workspaces).
 * Provides methods for discovering, joining, and requesting to join workspaces.
 */
export class BrowseWorkspacesPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly workspaceGrid: Locator;
  readonly backButton: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;
  readonly requestDialog: Locator;
  readonly requestMessageInput: Locator;
  readonly submitRequestButton: Locator;
  readonly cancelRequestButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: /browse workspaces/i });
    this.workspaceGrid = page.locator('.grid');
    this.backButton = page.getByRole('button', { name: /back/i });
    this.emptyState = page.getByText(/no workspaces available/i);
    this.errorState = page.locator('[class*="destructive"]');
    this.requestDialog = page.getByRole('dialog');
    this.requestMessageInput = page.getByRole('textbox', { name: /message/i });
    this.submitRequestButton = page.getByRole('button', { name: /submit request/i });
    this.cancelRequestButton = page.getByRole('button', { name: /cancel/i });
  }

  /**
   * Navigate to the browse workspaces page.
   */
  async goto() {
    await this.page.goto('/browse-workspaces');
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Wait for the workspace list to load.
   */
  async waitForWorkspaces() {
    // Wait for loading skeletons to disappear
    await this.page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 10000 }).catch(() => {
      // Skeletons may already be gone
    });
  }

  /**
   * Get a workspace card by name.
   */
  getWorkspaceCard(name: string) {
    return this.page.locator('[class*="Card"]').filter({
      has: this.page.getByRole('heading', { name, level: 3 }),
    });
  }

  /**
   * Get the join button for a specific workspace.
   */
  getJoinButton(workspaceName: string) {
    return this.getWorkspaceCard(workspaceName).getByRole('button', { name: /^join$/i });
  }

  /**
   * Get the "Request to Join" button for a specific workspace.
   */
  getRequestButton(workspaceName: string) {
    return this.getWorkspaceCard(workspaceName).getByRole('button', { name: /request to join/i });
  }

  /**
   * Get the pending button for a specific workspace.
   */
  getPendingButton(workspaceName: string) {
    return this.getWorkspaceCard(workspaceName).getByRole('button', { name: /request pending/i });
  }

  /**
   * Join an open workspace (instant join).
   */
  async joinWorkspace(name: string) {
    await this.waitForWorkspaces();
    await this.getJoinButton(name).click();
    // Wait for navigation after successful join
    await this.page.waitForURL(new RegExp(`/${name.toLowerCase().replace(/\\s+/g, '-')}`));
  }

  /**
   * Request to join a workspace that requires approval.
   */
  async requestJoin(name: string, message?: string) {
    await this.waitForWorkspaces();
    await this.getRequestButton(name).click();

    // Wait for dialog to appear
    await expect(this.requestDialog).toBeVisible();

    // Fill message if provided
    if (message) {
      await this.requestMessageInput.fill(message);
    }

    // Submit the request
    await this.submitRequestButton.click();

    // Wait for dialog to close
    await expect(this.requestDialog).toBeHidden();
  }

  /**
   * Assert a workspace is visible in the browse list.
   */
  async expectWorkspaceVisible(name: string) {
    await this.waitForWorkspaces();
    await expect(this.getWorkspaceCard(name)).toBeVisible();
  }

  /**
   * Assert a workspace has a specific join policy displayed.
   */
  async expectWorkspaceJoinable(name: string) {
    await this.waitForWorkspaces();
    await expect(this.getJoinButton(name)).toBeVisible();
  }

  /**
   * Assert a workspace requires a join request.
   */
  async expectWorkspaceRequestable(name: string) {
    await this.waitForWorkspaces();
    await expect(this.getRequestButton(name)).toBeVisible();
  }

  /**
   * Assert a workspace has a pending request.
   */
  async expectWorkspacePending(name: string) {
    await this.waitForWorkspaces();
    await expect(this.getPendingButton(name)).toBeVisible();
  }

  /**
   * Get the member count displayed for a workspace.
   */
  async getMemberCount(name: string): Promise<number> {
    await this.waitForWorkspaces();
    const card = this.getWorkspaceCard(name);
    const memberText = await card.getByText(/\d+ member/).textContent();
    if (!memberText) return 0;
    const match = memberText.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
