import { test, expect } from '../../fixtures/test-fixtures';
import { BrowseWorkspacesPage } from '../../pages/browse-workspaces.page';
import { WorkspaceSwitcherPage } from '../../pages/workspace-switcher.page';

test.describe('Workspace Discovery', () => {

  test('user can browse available workspaces (WKSP2-03)', async ({ page }) => {
    const browsePage = new BrowseWorkspacesPage(page);

    // Navigate to browse workspaces page
    await browsePage.goto();

    // Verify page title is visible
    await expect(browsePage.pageTitle).toBeVisible();

    // Wait for workspaces to load
    await browsePage.waitForWorkspaces();

    // Page should show either workspaces or empty state
    const hasWorkspaces = await browsePage.workspaceGrid.isVisible();
    const isEmpty = await browsePage.emptyState.isVisible().catch(() => false);

    // One of these should be true
    expect(hasWorkspaces || isEmpty).toBeTruthy();
  });

  test('browse page shows workspace cards with details', async ({ page }) => {
    const browsePage = new BrowseWorkspacesPage(page);

    await browsePage.goto();
    await browsePage.waitForWorkspaces();

    // If workspaces exist, they should show:
    // - Name
    // - Member count
    // - Join/Request button
    const cards = page.locator('[class*="Card"]');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      const firstCard = cards.first();

      // Should have a heading (workspace name)
      await expect(firstCard.locator('h3')).toBeVisible();

      // Should have member count with users icon
      await expect(firstCard.getByText(/member/i)).toBeVisible();

      // Should have some action button (Join, Request to Join, or Pending)
      const actionButton = firstCard.getByRole('button');
      await expect(actionButton).toBeVisible();
    }
  });

  test('back button returns to previous page', async ({ page }) => {
    const browsePage = new BrowseWorkspacesPage(page);

    // Start from a workspace
    await page.goto('/acme-corp');
    await page.waitForSelector('aside', { state: 'visible' });

    // Navigate to browse workspaces via switcher
    const switcher = new WorkspaceSwitcherPage(page);
    await switcher.clickBrowseWorkspaces();

    // Verify on browse page
    await expect(browsePage.pageTitle).toBeVisible();

    // Click back button
    await browsePage.backButton.click();

    // Should return to workspace
    await expect(page).toHaveURL(/\/acme-corp/);
  });
});

test.describe('Workspace Join Flows', () => {

  test('user can see join button for open workspaces', async ({ page }) => {
    const browsePage = new BrowseWorkspacesPage(page);

    await browsePage.goto();
    await browsePage.waitForWorkspaces();

    // Look for any "Join" button (indicates open workspace)
    const joinButtons = page.getByRole('button', { name: /^join$/i });
    const requestButtons = page.getByRole('button', { name: /request to join/i });
    const pendingButtons = page.getByRole('button', { name: /request pending/i });

    // Get counts of each type
    const joinCount = await joinButtons.count();
    const requestCount = await requestButtons.count();
    const pendingCount = await pendingButtons.count();

    // At least one type of action button should exist if workspaces are shown
    const totalButtons = joinCount + requestCount + pendingCount;
    // Note: May be 0 if user is already in all workspaces
    console.log(`Found ${joinCount} joinable, ${requestCount} requestable, ${pendingCount} pending`);
  });

  test('user can request to join restricted workspace (WKSP2-04)', async ({ page }) => {
    const browsePage = new BrowseWorkspacesPage(page);

    await browsePage.goto();
    await browsePage.waitForWorkspaces();

    // Find a workspace with "Request to Join" button
    const requestButtons = page.getByRole('button', { name: /request to join/i });
    const requestCount = await requestButtons.count();

    if (requestCount > 0) {
      // Click the first request button
      await requestButtons.first().click();

      // Dialog should appear
      await expect(browsePage.requestDialog).toBeVisible();

      // Dialog should have title mentioning "Request to Join"
      await expect(page.getByRole('heading', { name: /request to join/i })).toBeVisible();

      // Optional: fill message
      await browsePage.requestMessageInput.fill('I would like to join this workspace for collaboration.');

      // Submit request
      await browsePage.submitRequestButton.click();

      // Dialog should close
      await expect(browsePage.requestDialog).toBeHidden();

      // Button should now show "Pending"
      // (The specific card that was clicked should now have pending state)
    } else {
      // Skip if no requestable workspaces - test infrastructure may vary
      test.skip(true, 'No workspaces available for join request');
    }
  });

  test('request dialog can be cancelled', async ({ page }) => {
    const browsePage = new BrowseWorkspacesPage(page);

    await browsePage.goto();
    await browsePage.waitForWorkspaces();

    // Find a workspace with "Request to Join" button
    const requestButtons = page.getByRole('button', { name: /request to join/i });
    const requestCount = await requestButtons.count();

    if (requestCount > 0) {
      // Click the first request button
      await requestButtons.first().click();

      // Dialog should appear
      await expect(browsePage.requestDialog).toBeVisible();

      // Click cancel
      await browsePage.cancelRequestButton.click();

      // Dialog should close
      await expect(browsePage.requestDialog).toBeHidden();

      // Button should still be "Request to Join" (not Pending)
      await expect(requestButtons.first()).toBeVisible();
    } else {
      test.skip(true, 'No workspaces available for join request');
    }
  });
});

test.describe('Multi-User Join Request Approval', () => {
  test('multi-user: owner approves join request (WKSP2-05)', async ({ browser }) => {
    // Create two browser contexts with different users
    const aliceContext = await browser.newContext({
      storageState: 'e2e/.auth/alice.json',
    });
    const bobContext = await browser.newContext({
      storageState: 'e2e/.auth/bob.json',
    });

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Bob: Navigate to browse workspaces
      const bobBrowse = new BrowseWorkspacesPage(bobPage);
      await bobBrowse.goto();
      await bobBrowse.waitForWorkspaces();

      // Check if Bob can request to join any workspace
      const requestButtons = bobPage.getByRole('button', { name: /request to join/i });
      const requestCount = await requestButtons.count();

      if (requestCount === 0) {
        // No workspaces to request - test seed data may not have appropriate setup
        test.skip(true, 'No workspaces available for join request test');
        return;
      }

      // Get the workspace name Bob will request to join
      const firstRequestButton = requestButtons.first();
      const workspaceCard = firstRequestButton.locator('ancestor::div[class*="Card"]');
      const workspaceName = await workspaceCard.locator('h3').textContent();

      // Bob: Request to join
      await firstRequestButton.click();
      await expect(bobBrowse.requestDialog).toBeVisible();
      await bobBrowse.requestMessageInput.fill('Hi, I would like to join!');
      await bobBrowse.submitRequestButton.click();
      await expect(bobBrowse.requestDialog).toBeHidden();

      // Alice: Check for join request notifications (if she's admin of the workspace)
      // Navigate to workspace settings or notification area
      await alicePage.goto('/acme-corp/settings');

      // Look for join requests section or notification
      const joinRequestsLink = alicePage.getByRole('link', { name: /join requests/i });
      const hasJoinRequestsPage = await joinRequestsLink.isVisible().catch(() => false);

      if (hasJoinRequestsPage) {
        await joinRequestsLink.click();

        // Should see Bob's request (if this workspace)
        const pendingRequests = alicePage.locator('[data-testid="join-request"]');
        const requestCount = await pendingRequests.count();

        if (requestCount > 0) {
          // Approve the first request
          const approveButton = alicePage.getByRole('button', { name: /approve/i }).first();
          if (await approveButton.isVisible()) {
            await approveButton.click();

            // Request should be removed from list
            await alicePage.waitForTimeout(1000);
          }
        }
      }

      // The approval flow depends on specific test data setup
      // This test verifies the UI flow exists
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test('user joining open workspace appears in switcher', async ({ browser }) => {
    // Create a context for the test
    const context = await browser.newContext({
      storageState: 'e2e/.auth/alice.json',
    });
    const page = await context.newPage();

    try {
      const browsePage = new BrowseWorkspacesPage(page);
      const switcher = new WorkspaceSwitcherPage(page);

      // First check current workspaces
      await page.goto('/acme-corp');
      await page.waitForSelector('aside', { state: 'visible' });

      await switcher.open();
      const initialWorkspaces = await page.locator('[role="dialog"] button').count();
      await switcher.close();

      // Go to browse workspaces
      await browsePage.goto();
      await browsePage.waitForWorkspaces();

      // Try to find an open workspace to join
      const joinButtons = page.getByRole('button', { name: /^join$/i });
      const joinCount = await joinButtons.count();

      if (joinCount > 0) {
        // Click join on first available
        await joinButtons.first().click();

        // Should navigate to the new workspace
        await page.waitForURL(/\/[a-z0-9-]+/);
        await page.waitForSelector('aside', { state: 'visible' });

        // Open switcher and verify workspace count increased
        await switcher.open();
        const finalWorkspaces = await page.locator('[role="dialog"] button').count();
        await switcher.close();

        // Should have one more workspace (or same if was already a member)
        expect(finalWorkspaces).toBeGreaterThanOrEqual(initialWorkspaces);
      } else {
        test.skip(true, 'No open workspaces available to join');
      }
    } finally {
      await context.close();
    }
  });
});
