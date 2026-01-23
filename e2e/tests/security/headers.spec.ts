import { test, expect } from '../../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Security Headers Tests
 * SEC2-17: SRI hashes on static assets
 * SEC2-18: Security headers on API routes
 */

test.describe('Security Headers', () => {
  test('security headers present on API routes', async ({ request }) => {
    // Make request to /api/health (public API route)
    const response = await request.get('/api/health');

    // Verify X-Content-Type-Options
    const contentTypeOptions = response.headers()['x-content-type-options'];
    expect(contentTypeOptions).toBe('nosniff');

    // Verify X-Frame-Options
    const frameOptions = response.headers()['x-frame-options'];
    expect(frameOptions).toBeTruthy();
    expect(frameOptions).toMatch(/DENY|SAMEORIGIN/i);

    // Verify Referrer-Policy
    const referrerPolicy = response.headers()['referrer-policy'];
    expect(referrerPolicy).toBeTruthy();
    expect(referrerPolicy).toContain('origin');

    // Verify X-XSS-Protection
    const xssProtection = response.headers()['x-xss-protection'];
    expect(xssProtection).toBeTruthy();
  });

  test('security headers present on authenticated page routes', async ({ authenticatedPage }) => {
    // Capture headers from the main document response
    let documentHeaders: Record<string, string> = {};

    await authenticatedPage.route('**/acme-corp', async (route) => {
      const response = await route.fetch();
      documentHeaders = response.headers();
      await route.fulfill({ response });
    });

    // Navigate to an authenticated page
    await authenticatedPage.goto('/acme-corp');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify security headers are present on authenticated HTML pages
    // Note: X-Content-Type-Options may not be set on HTML pages, but CSP and other headers should be
    expect(documentHeaders['content-security-policy']).toBeTruthy();
    expect(documentHeaders['x-nonce']).toBeTruthy();
  });

  test('Cache-Control set to no-store on API routes', async ({ request }) => {
    const response = await request.get('/api/health');

    // API routes should not be cached
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain('no-store');
  });

  test('CSP report-uri directive is present', async ({ page }) => {
    let cspHeader: string | null = null;

    await page.route('**/*', async (route) => {
      const response = await route.fetch();
      const headers = response.headers();
      if (headers['content-security-policy']) {
        cspHeader = headers['content-security-policy'];
      }
      await route.fulfill({ response });
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    expect(cspHeader).toBeTruthy();
    // Verify CSP report-uri is set for violation reporting
    expect(cspHeader).toContain('report-uri /api/csp-report');
  });
});

test.describe('SRI (Subresource Integrity)', () => {
  // Helper to load SRI manifest from filesystem
  const loadSriManifest = () => {
    const manifestPath = path.join(process.cwd(), 'public', 'sri-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  };

  test('SRI manifest file exists and is valid', async () => {
    // Read SRI manifest directly from filesystem (it's in public folder)
    const manifest = loadSriManifest();

    // Verify manifest exists
    expect(manifest).not.toBeNull();

    // Verify manifest has expected structure
    expect(manifest).toHaveProperty('generated');
    expect(manifest).toHaveProperty('files');
    expect(typeof manifest.files).toBe('object');

    // Verify there are some files in the manifest
    const fileKeys = Object.keys(manifest.files);
    expect(fileKeys.length).toBeGreaterThan(0);

    // Verify hashes are in correct format (sha384-base64)
    for (const [filePath, hash] of Object.entries(manifest.files)) {
      expect(typeof hash).toBe('string');
      expect(hash as string).toMatch(/^sha384-[A-Za-z0-9+/=]+$/);
    }
  });

  test('SRI hashes cover critical Next.js chunks', async () => {
    const manifest = loadSriManifest();
    expect(manifest).not.toBeNull();

    const files = Object.keys(manifest.files);

    // Verify critical chunks are covered
    const hasFrameworkChunk = files.some((f) => f.includes('framework-'));
    const hasMainChunk = files.some((f) => f.includes('main-'));
    const hasWebpackChunk = files.some((f) => f.includes('webpack-'));

    expect(hasFrameworkChunk).toBeTruthy();
    expect(hasMainChunk).toBeTruthy();
    expect(hasWebpackChunk).toBeTruthy();
  });

  test('static assets have integrity attributes when loaded', async ({ page }) => {
    // This test verifies that when scripts are loaded, they include integrity attributes
    // Note: Next.js handles SRI injection at build time in production

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // In production with SRI enabled, script tags should have integrity attributes
    // In development, SRI is typically not applied
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Get all script elements
      const scripts = await page.locator('script[src*="/_next/static"]').all();

      // At least some scripts should have integrity attributes in production
      let scriptsWithIntegrity = 0;
      for (const script of scripts) {
        const integrity = await script.getAttribute('integrity');
        if (integrity) {
          scriptsWithIntegrity++;
          // Verify integrity format
          expect(integrity).toMatch(/^sha384-[A-Za-z0-9+/=]+$/);
        }
      }

      // In production, we expect SRI to be applied
      if (scripts.length > 0) {
        expect(scriptsWithIntegrity).toBeGreaterThan(0);
      }
    }
  });
});
