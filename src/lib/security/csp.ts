/**
 * Generate a cryptographic nonce for CSP
 * Returns base64-encoded random bytes (128+ bits entropy)
 */
export function generateNonce(): string {
  // Use Web Crypto API (works in Edge Runtime)
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString('base64');
}

/**
 * Generate Content Security Policy header
 * @param nonce - Cryptographic nonce for script authorization
 * @param isDev - Whether in development mode (allows unsafe-eval for HMR)
 */
export function generateCSP(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
    report-uri /api/csp-report;
  `;

  // Remove excess whitespace and format as single line
  return csp.replace(/\s{2,}/g, ' ').trim();
}
