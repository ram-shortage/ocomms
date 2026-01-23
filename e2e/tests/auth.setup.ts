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
      alice: {
        email: 'alice.chen@example.com',
        password: 'TheOrder2026!!',
        storageFile: 'alice.json',
      },
      bob: {
        email: 'bob.martinez@example.com',
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
  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect - either workspace picker or direct workspace
  // The app shows a workspace picker if user has workspaces
  await page.waitForURL(/\/(acme-corp|browse-workspaces)?$/, { timeout: 30000 });

  // If on workspace picker page, click through to acme-corp
  if (await page.getByText('Your Workspaces').isVisible()) {
    await page.getByRole('link', { name: /acme-corp/i }).click();
    await expect(page).toHaveURL(/\/acme-corp/, { timeout: 10000 });
  }

  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

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
