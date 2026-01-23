import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.join(__dirname, '..', '.auth');

// Test user credentials (from demo seed data)
const testUsers = {
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
  // Navigate to sign-in page
  await page.goto('/sign-in');

  // Fill in credentials
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to workspace (indicates successful login)
  await expect(page).toHaveURL(/\/[a-z0-9-]+$/, { timeout: 30000 });

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
