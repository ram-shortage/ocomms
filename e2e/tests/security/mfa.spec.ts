import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MFA (Multi-Factor Authentication) Security Tests
 * SEC2-21: MFA setup and verification
 *
 * Note: Full TOTP verification requires generating valid codes,
 * which is complex in E2E. These tests verify the MFA UI flow works.
 */

const authDir = path.join(__dirname, '..', '..', '.auth');

// Helper to check if storage state has valid cookies
function hasValidCookies(storagePath: string): boolean {
  if (!fs.existsSync(storagePath)) return false;
  try {
    const storage = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    return storage.cookies && storage.cookies.length > 0;
  } catch {
    return false;
  }
}

test.describe('MFA Security', () => {
  // Tests requiring authenticated context
  test.describe('with authenticated context', () => {
    test.beforeEach(async ({}, testInfo) => {
      const storagePath = path.join(authDir, 'alice.json');
      if (!hasValidCookies(storagePath)) {
        testInfo.skip();
      }
    });

    test('MFA setup UI is accessible from security settings', async ({ browser }) => {
      const storagePath = path.join(authDir, 'alice.json');
      const context = await browser.newContext({
        storageState: storagePath,
      });
      const page = await context.newPage();

      // Navigate to security settings
      await page.goto('/acme-corp/profile/security');
      await page.waitForLoadState('networkidle');

      // Look for MFA-related UI elements
      const mfaHeading = page.getByText(/two.?factor|2fa|multi.?factor/i);
      const enableButton = page.getByRole('button', {
        name: /enable|set up|configure/i,
      });

      // MFA section should be visible
      const hasMfaSection =
        (await mfaHeading.first().isVisible({ timeout: 5000 }).catch(() => false)) ||
        (await enableButton.first().isVisible({ timeout: 5000 }).catch(() => false));

      expect(hasMfaSection).toBe(true);

      await context.close();
    });

    test('MFA enable button triggers setup flow', async ({ browser }) => {
      const storagePath = path.join(authDir, 'alice.json');
      const context = await browser.newContext({
        storageState: storagePath,
      });
      const page = await context.newPage();

      // Navigate to security settings
      await page.goto('/acme-corp/profile/security');
      await page.waitForLoadState('networkidle');

      // Find enable MFA button
      const enableButton = page.getByRole('button', {
        name: /enable.*2fa|enable.*two.?factor|enable.*mfa|set up/i,
      });

      if (await enableButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await enableButton.first().click();

        // After clicking, should see QR code or setup instructions
        // Wait for setup UI to appear
        await page.waitForTimeout(1000);

        // Look for setup elements (QR code image or text instructions)
        const qrCode = page.locator('img[alt*="QR"], canvas, svg[class*="qr"]');
        const setupText = page.getByText(/scan.*qr|authenticator|secret key|backup code/i);

        const hasSetupUI =
          (await qrCode.first().isVisible({ timeout: 5000 }).catch(() => false)) ||
          (await setupText.first().isVisible({ timeout: 5000 }).catch(() => false));

        // Setup UI should appear after clicking enable
        expect(hasSetupUI).toBe(true);
      }

      await context.close();
    });
  });

  // API-level MFA tests
  test('better-auth two-factor plugin is configured', async () => {
    // Check that the auth client exports twoFactor
    const authClientPath = path.join(
      process.cwd(),
      'src',
      'lib',
      'auth-client.ts'
    );

    expect(fs.existsSync(authClientPath)).toBe(true);

    const content = fs.readFileSync(authClientPath, 'utf-8');

    // Should have twoFactor plugin configured
    expect(content).toContain('twoFactorClient');
    expect(content).toContain('twoFactor');
  });

  test('MFA setup component exists', async () => {
    // Check that MFA setup component is present
    const mfaSetupPath = path.join(
      process.cwd(),
      'src',
      'components',
      'settings',
      'mfa-setup.tsx'
    );

    expect(fs.existsSync(mfaSetupPath)).toBe(true);

    const content = fs.readFileSync(mfaSetupPath, 'utf-8');

    // Should handle MFA setup flow
    expect(content).toContain('totp');
    expect(content).toContain('backup');
  });
});
