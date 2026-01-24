import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.join(__dirname, '..', '.auth');

// Test user credentials
// Supports both e2e-seed (minimal) and demo-seed (comprehensive) data
const DEMO_SEED_MODE = process.env.E2E_SEED_MODE === 'demo';

const testUsers = DEMO_SEED_MODE
  ? {
      // demo-seed.ts credentials (comprehensive data)
      // Note: demo-seed adds users[0-4] to workspaces 2-4 (TechStart, Innovation, Digital)
      // but NOT to Acme Corp (workspace 1) due to random shuffle
      alice: {
        email: 'alice.chen@example.com',
        password: 'TheOrder2026!!',
        storageFile: 'alice.json',
      },
      bob: {
        email: 'bob.chen@example.com',
        password: 'TheOrder2026!!',
        storageFile: 'bob.json',
      },
    }
  : {
      // e2e-seed.ts credentials (minimal data)
      alice: {
        email: 'alice@demo.ocomms.local',
        password: 'password123',
        storageFile: 'alice.json',
      },
      bob: {
        email: 'bob@demo.ocomms.local',
        password: 'password123',
        storageFile: 'bob.json',
      },
    };

/**
 * Authenticate a test user and save storage state.
 */
async function authenticateUser(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  storageFile: string
) {
  // Navigate to login page and wait for it to be fully loaded
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Wait for the form to be interactive
  await page.locator('#email').waitFor({ state: 'visible' });

  // Fill in credentials - use click + type for more reliability in headless mode
  await page.locator('#email').click();
  await page.locator('#email').fill(email);
  await page.locator('#password').click();
  await page.locator('#password').fill(password);

  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });

  // Check if we're still on an error state (login might have shown error then user got stuck)
  const errorElement = page.locator('.text-red-600');
  if (await errorElement.isVisible({ timeout: 100 }).catch(() => false)) {
    const errorText = await errorElement.textContent();
    throw new Error(`Login failed: ${errorText}`);
  }

  // If on workspace picker page, navigate to Acme Corporation workspace
  if (await page.getByText('Your Workspaces').isVisible()) {
    // Navigate directly to the workspace
    await page.goto('/acme-corp');
    await expect(page).toHaveURL(/\/acme-corp/, { timeout: 10000 });
  }

  // Wait for the workspace page to fully load
  await page.waitForLoadState('networkidle');

  // Small delay to ensure all cookies are set (session_token and session_data)
  await page.waitForTimeout(1000);

  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Debug: log cookies before saving
  const cookies = await page.context().cookies('http://localhost:3000');
  console.log(`Cookies for ${email}:`, cookies.map(c => c.name));

  // Save storage state
  const storagePath = path.join(authDir, storageFile);
  await page.context().storageState({ path: storagePath });

  console.log(`Saved storage state for ${email} to ${storagePath}`);
}

setup('authenticate alice', async ({ page }) => {
  await authenticateUser(
    page,
    testUsers.alice.email,
    testUsers.alice.password,
    testUsers.alice.storageFile
  );

  // Create user.json as alias to alice.json for backward compatibility
  const alicePath = path.join(authDir, 'alice.json');
  const userPath = path.join(authDir, 'user.json');
  fs.copyFileSync(alicePath, userPath);
  console.log('Created user.json as alias to alice.json');
});

setup('authenticate bob', async ({ page }) => {
  await authenticateUser(
    page,
    testUsers.bob.email,
    testUsers.bob.password,
    testUsers.bob.storageFile
  );
});
