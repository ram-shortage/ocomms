---
phase: 30-critical-security
plan: 01
title: "CSP Nonce Implementation"
status: complete
subsystem: security
tags: [security, csp, xss-prevention, middleware, next.js]

requires: []
provides:
  - CSP header generation with per-request nonces
  - CSP violation reporting infrastructure
  - Nonce propagation through Next.js layout
affects:
  - All future script additions require nonce attribute
  - CSP violations logged for monitoring

tech-stack:
  added:
    - Web Crypto API for nonce generation
  patterns:
    - Per-request nonce generation in middleware
    - CSP header injection via Next.js middleware
    - Header-based context passing (x-nonce)

key-files:
  created:
    - src/lib/security/csp.ts
    - src/app/api/csp-report/route.ts
  modified:
    - src/middleware.ts
    - src/app/layout.tsx

decisions:
  - decision: "Use Web Crypto API instead of Node.js crypto"
    rationale: "Next.js middleware runs in Edge Runtime which doesn't support Node.js modules"
    alternatives: ["Node.js crypto (incompatible)", "UUID library (unnecessary dependency)"]
  - decision: "Keep unsafe-inline for style-src"
    rationale: "Per CONTEXT.md decision - CSS injection less critical, inline styles needed for dynamic theming"
    alternatives: ["Strict CSS nonces (breaks dynamic theming)"]
  - decision: "Use report-uri instead of report-to"
    rationale: "Better browser support, simpler implementation for initial version"
    alternatives: ["report-to (newer standard, requires JSON endpoint configuration)"]

metrics:
  tasks: 3
  commits: 3
  files-modified: 4
  duration: "6 minutes"
  completed: "2026-01-22"
---

# Phase 30 Plan 01: CSP Nonce Implementation Summary

**One-liner:** Implemented Content Security Policy with cryptographic nonces for script authorization, eliminating unsafe-inline XSS vectors in production.

## What Was Built

### Core CSP Infrastructure

**CSP Utility Library** (`src/lib/security/csp.ts`)
- `generateNonce()`: Generates 128-bit cryptographic nonces using Web Crypto API
- `generateCSP()`: Builds CSP header with environment-aware directives
- Production CSP removes unsafe-inline/unsafe-eval
- Development CSP includes unsafe-eval for Next.js hot module reload

**Middleware Integration** (`src/middleware.ts`)
- Generates unique nonce per request
- Sets Content-Security-Policy header on all responses
- Propagates nonce via x-nonce request header
- Added /api/csp-report to public routes

**Layout Nonce Propagation** (`src/app/layout.tsx`)
- Made RootLayout async to read headers
- Extracts nonce for future Script component usage
- Infrastructure ready for nonce-protected third-party scripts

**Violation Reporting** (`src/app/api/csp-report/route.ts`)
- POST endpoint receives browser CSP violation reports
- Structured logging with timestamp, user agent, violation details
- Returns 204 No Content (standard for report endpoints)

### CSP Policy Details

**Production Directives:**
```
default-src 'self';
script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:;
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-uri /api/csp-report;
```

**Development Additions:**
- `script-src` includes `'unsafe-eval'` for Next.js HMR

## Technical Implementation

### Web Crypto API for Edge Runtime

Used `crypto.getRandomValues()` instead of Node.js `crypto.randomBytes()` because Next.js middleware runs in Edge Runtime:

```typescript
export function generateNonce(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString('base64');
}
```

### Per-Request Nonce Generation

Middleware generates fresh nonce for each request:
1. Generate nonce at middleware entry
2. Build CSP header with nonce
3. Set Content-Security-Policy response header
4. Set x-nonce request header for downstream access

### Nonce Propagation Pattern

```typescript
// Middleware sets header
response.headers.set('x-nonce', nonce);

// Layout reads header
const nonce = (await headers()).get('x-nonce') || '';
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f433f51 | feat(30-01): implement CSP with nonce-based script loading |
| 2 | a42ebe1 | feat(30-01): propagate CSP nonce to layout |
| 3 | d253bb9 | feat(30-01): add CSP violation reporting endpoint |

## Verification Results

- Build completes without errors
- CSP header present on all page responses
- Development mode includes unsafe-eval (HMR compatible)
- Production mode excludes unsafe-eval/unsafe-inline
- `/api/csp-report` endpoint accepts violation reports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Edge Runtime incompatibility**
- **Found during:** Task 1 build
- **Issue:** Initial implementation used Node.js `crypto` module which is not supported in Edge Runtime
- **Fix:** Switched to Web Crypto API (`crypto.getRandomValues()`)
- **Files modified:** src/lib/security/csp.ts
- **Commit:** f433f51

## Security Impact

### XSS Protection Improvements

**Before:**
- No CSP (implicit unsafe-inline, unsafe-eval allowed)
- All inline scripts execute regardless of origin
- No visibility into script loading violations

**After:**
- Strict CSP with nonce-based script authorization
- Only scripts with valid nonce can execute
- Violations logged to server for monitoring
- Development workflow preserved with HMR support

### Attack Surface Reduction

- **Inline script injection:** Blocked (nonce required)
- **Eval-based XSS:** Blocked in production
- **Base tag hijacking:** Blocked (base-uri 'self')
- **Clickjacking:** Blocked (frame-ancestors 'none')
- **Form action hijacking:** Blocked (form-action 'self')

## Integration Points

### For Future Development

When adding Script components:
```tsx
// In any component
const nonce = (await headers()).get('x-nonce') || '';

<Script
  src="/analytics.js"
  nonce={nonce}
  strategy="afterInteractive"
/>
```

### For Monitoring

CSP violations appear in server logs:
```json
{
  "documentUri": "https://app.ocomms.com/workspace",
  "violatedDirective": "script-src",
  "blockedUri": "inline",
  "timestamp": "2026-01-22T22:56:51Z",
  "userAgent": "Mozilla/5.0..."
}
```

## Next Phase Readiness

**Phase 31 (Input Validation):**
- CSP headers now active, any inline scripts will be blocked
- Test coverage needed to verify no CSP violations in existing code
- Third-party integrations may require nonce addition

**Phase 32 (Rate Limiting):**
- CSP report endpoint is public (intentionally)
- May need rate limiting to prevent report flooding attacks

**Phase 33 (Audit Logging):**
- CSP violations could feed into audit log system
- Consider structured logging format compatibility

## Outstanding Considerations

### CSP Report Flooding
The `/api/csp-report` endpoint is public and unauthenticated (required for browser violation reporting). Consider:
- Rate limiting per IP
- Report aggregation before logging
- Honeypot detection (repeated violations from same source)

### Third-Party Scripts
Future additions of analytics, error tracking, or CDN scripts will require:
- Nonce propagation to Script components
- Verification that third-party scripts work with strict-dynamic
- Possible CSP adjustments for specific services

### Style Security
Current policy allows `style-src 'unsafe-inline'` per CONTEXT.md decision. Future hardening could:
- Use CSS nonces for critical inline styles
- Move dynamic theming to CSS custom properties
- Trade-off: Implementation complexity vs marginal security gain

## Documentation Updates Needed

- [ ] Update DEPLOYMENT.md with CSP configuration notes
- [ ] Document nonce pattern for developers adding scripts
- [ ] Add CSP violation monitoring to ops runbook
- [ ] Update security policy documentation

## Test Coverage Recommendations

- Unit tests for generateNonce() entropy
- Integration tests for CSP header presence
- E2E tests to verify no CSP violations on core flows
- Load test CSP report endpoint for abuse scenarios
