# Phase 30: Critical Security - Research

**Researched:** 2026-01-22
**Domain:** Web application security - CSP, session management, file upload sanitization
**Confidence:** HIGH

## Summary

Researched three critical security domains for Next.js applications: CSP nonce-based script loading, server-side session validation with Redis, and SVG sanitization/conversion to prevent XSS attacks.

The standard approach for CSP in Next.js uses middleware to generate cryptographically secure nonces per request, with automatic application to framework scripts via header parsing. This requires dynamic rendering (no static pages) and has significant performance implications. For session management, Redis provides immediate revocation capabilities through direct key deletion and user-to-session indexing using SET data structures. For SVG security, the safest approach is complete elimination - converting all SVGs to raster formats (WebP/PNG) using Sharp, which has native SVG input support.

Key finding: All three areas have well-established patterns with mature libraries (Next.js native CSP, connect-redis v9.x, Sharp, DOMPurify v3.3.1), but each requires careful implementation to avoid common pitfalls that can completely negate security benefits.

**Primary recommendation:** Use Next.js middleware-based CSP nonces with strict-dynamic, Redis SET-based session indexing for instant revocation, and Sharp for SVG-to-raster conversion (blocking all SVG uploads entirely).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js (built-in) | 13.4.20+ | CSP nonce generation and application | Native framework support, automatic nonce injection into scripts |
| connect-redis | 9.x | Redis session store for express-session | Official Redis session adapter, handles TTL and key management automatically |
| redis | latest | Redis client for Node.js | Official Node.js Redis client, supports modern async/await |
| sharp | latest | Image processing and SVG conversion | High-performance native library, supports SVG input and WebP/PNG output |
| express-session | latest | Session middleware | De facto standard for Express/Next.js session management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | 3.3.1 | SVG/HTML sanitization (optional) | Only if allowing SVG content instead of converting to raster |
| jsdom | 20.0.0+ | DOM environment for server-side DOMPurify | Required for server-side DOMPurify (but NOT needed if converting SVGs) |
| isomorphic-dompurify | latest | Wrapper for DOMPurify | Simplifies server/client DOMPurify usage (optional helper) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nonce-based CSP | Hash-based CSP | Hashes work with static pages but break on any whitespace change, fragile |
| Nonce-based CSP | Subresource Integrity (SRI) | Experimental Next.js feature, webpack-only, cannot handle dynamic scripts |
| connect-redis | Custom Redis implementation | More control but loses automatic TTL management and session compatibility |
| Sharp SVG conversion | DOMPurify sanitization | Sanitization is complex and error-prone; conversion eliminates all risk |
| WebP format | PNG only | WebP offers better compression; include PNG fallback for older browsers |

**Installation:**
```bash
npm install connect-redis redis express-session sharp
# Only if sanitizing SVGs instead of converting (NOT recommended):
# npm install dompurify jsdom
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── middleware.ts                      # CSP nonce generation, session validation
├── app/
│   ├── api/
│   │   ├── csp-report/route.ts       # CSP violation reporting endpoint
│   │   ├── sessions/
│   │   │   ├── list/route.ts         # List user's active sessions
│   │   │   └── revoke/route.ts       # Revoke specific or all sessions
│   │   └── auth/
│   │       └── logout/route.ts       # Single device logout
│   └── layout.tsx                     # Access nonce for Script components
├── lib/
│   ├── redis.ts                       # Redis client singleton
│   ├── session.ts                     # Session store configuration
│   └── security/
│       ├── csp.ts                     # CSP header generation
│       └── file-upload.ts             # SVG conversion utilities
└── types/
    └── session.d.ts                   # Session data types
```

### Pattern 1: CSP Nonce Generation in Middleware
**What:** Generate unique nonce per request, inject into CSP header and request headers
**When to use:** All pages requiring strict CSP without unsafe-inline
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/content-security-policy
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Generate cryptographically secure nonce (128+ bits entropy)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Build CSP header with nonce and strict-dynamic
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
    report-uri /api/csp-report;
  `.replace(/\s{2,}/g, ' ').trim()

  // Set nonce in custom header for component access
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Set CSP header in response
  response.headers.set('Content-Security-Policy', cspHeader)

  return response
}

// Don't apply CSP to static assets and API routes
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

### Pattern 2: Accessing Nonce in Server Components
**What:** Read nonce from request headers to apply to Script components
**When to use:** Any Server Component using next/script
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/content-security-policy
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Page() {
  const nonce = (await headers()).get('x-nonce')

  return (
    <>
      <Script
        src="https://example.com/script.js"
        strategy="afterInteractive"
        nonce={nonce}
      />
    </>
  )
}
```

### Pattern 3: Redis Session Store with User Indexing
**What:** Store sessions in Redis with SET-based index for per-user session lookup
**When to use:** Multi-device session management with revocation capability
**Example:**
```typescript
// Source: https://redis.io/learn/develop/node/nodecrashcourse/sessionstorage
import session from 'express-session'
import RedisStore from 'connect-redis'
import { createClient } from 'redis'

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL
})
await redisClient.connect()

// Configure session store with user indexing
const sessionStore = new RedisStore({
  client: redisClient,
  prefix: 'sess:',
})

// Session middleware
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'
  }
}))

// On login, add session to user's session set
async function onLogin(userId: string, sessionId: string) {
  await redisClient.sAdd(`user:${userId}:sessions`, sessionId)
}

// Revoke all user sessions
async function revokeAllSessions(userId: string) {
  const sessionIds = await redisClient.sMembers(`user:${userId}:sessions`)

  // Delete each session
  const pipeline = redisClient.multi()
  for (const sessionId of sessionIds) {
    pipeline.del(`sess:${sessionId}`)
  }
  pipeline.del(`user:${userId}:sessions`)
  await pipeline.exec()
}

// List active sessions (for UI display)
async function listUserSessions(userId: string) {
  const sessionIds = await redisClient.sMembers(`user:${userId}:sessions`)
  const sessions = []

  for (const sessionId of sessionIds) {
    const data = await redisClient.get(`sess:${sessionId}`)
    if (data) {
      sessions.push(JSON.parse(data))
    }
  }

  return sessions
}
```

### Pattern 4: SVG to WebP/PNG Conversion
**What:** Convert SVG uploads to raster formats using Sharp
**When to use:** All file uploads, system asset migration
**Example:**
```typescript
// Source: https://sharp.pixelplumbing.com/api-output
import sharp from 'sharp'

async function convertSvgToRaster(svgBuffer: Buffer, format: 'webp' | 'png' = 'webp') {
  // Sharp automatically handles SVG input
  const converter = sharp(svgBuffer)

  if (format === 'webp') {
    return await converter
      .webp({ quality: 80 })
      .toBuffer()
  } else {
    return await converter
      .png({ compressionLevel: 9 })
      .toBuffer()
  }
}

// With sizing control
async function convertSvgWithResize(svgBuffer: Buffer, width: number, height: number) {
  return await sharp(svgBuffer)
    .resize(width, height, { fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer()
}

// Detect and reject SVG uploads
async function validateUpload(fileBuffer: Buffer, mimetype: string) {
  // Check MIME type
  if (mimetype === 'image/svg+xml') {
    throw new Error('SVG uploads are not allowed')
  }

  // Also check file content (MIME can be spoofed)
  const fileStart = fileBuffer.toString('utf8', 0, 100)
  if (fileStart.includes('<svg') || fileStart.includes('<?xml')) {
    throw new Error('SVG content detected and blocked')
  }
}
```

### Pattern 5: CSP Violation Reporting Endpoint
**What:** Receive and log CSP violation reports from browsers
**When to use:** Production monitoring of CSP policy effectiveness
**Example:**
```typescript
// app/api/csp-report/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const report = await request.json()

    // Log violation details (send to logging service in production)
    console.error('CSP Violation:', {
      documentUri: report['csp-report']?.documentUri,
      violatedDirective: report['csp-report']?.violatedDirective,
      blockedUri: report['csp-report']?.blockedUri,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
    })

    // Return 204 No Content
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Failed to process CSP report:', error)
    return new NextResponse(null, { status: 400 })
  }
}

// Note: Use both report-uri and report-to for browser compatibility
// Old format (report-uri): Expects JSON with csp-report wrapper
// New format (report-to): Expects Reporting API format
```

### Anti-Patterns to Avoid

- **Setting nonce on all script tags in HTML:** Don't create middleware that replaces all script tags with nonces - attacker-injected scripts will get nonces too. Use proper templating/framework support.
- **Using same nonce for multiple requests:** Nonces must be unique per request, not per user or per session. Reusing nonces defeats the purpose.
- **Mixing static and dynamic pages with CSP:** Nonce-based CSP requires all pages to be dynamically rendered. Don't use getStaticProps with nonce CSP.
- **Including unsafe-inline in production script-src:** Modern browsers ignore unsafe-inline when nonce is present, but don't include it for script-src (it's only safe for backward compat).
- **Scanning all Redis keys for session revocation:** Never use KEYS * in production. Maintain user-to-session indexes using SETs for O(1) lookups.
- **Sanitizing SVGs instead of converting:** SVG sanitization is error-prone and has known bypasses. Convert to raster formats instead.
- **Using outdated jsdom with DOMPurify:** jsdom v19 has known XSS vulnerabilities. If using DOMPurify, require jsdom v20.0.0+.
- **Trusting MIME types for upload validation:** Always validate file content, not just MIME type headers (easily spoofed).
- **Forgetting strict-dynamic:** Without strict-dynamic, nonce-based CSP breaks third-party scripts and framework code that dynamically creates scripts.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nonce generation | Custom random string generator | `Buffer.from(crypto.randomUUID()).toString('base64')` | Must be cryptographically secure with 128+ bits entropy |
| CSP header formatting | Manual string building | CSP builder libraries or Next.js pattern | Easy to miss directives or make syntax errors |
| Session store Redis integration | Direct Redis calls in session handler | connect-redis package | Handles TTL, serialization, key prefixes, and cleanup automatically |
| SVG sanitization | Custom XML parser and tag filter | DOMPurify (or better: don't allow SVGs) | XSS vectors in SVG are complex: script tags, event handlers, foreignObject, data URIs, etc. |
| Session revocation scanning | KEYS * pattern matching | User-to-session SET index | KEYS * blocks Redis in production; O(N) vs O(1) with SET |
| Image format detection | File extension checking | Sharp metadata or file magic bytes | Extensions and MIME types are unreliable |
| CSP violation analysis | Custom log parsing | Structured logging + monitoring service | Violation reports need aggregation and pattern detection |

**Key insight:** Security primitives are extremely difficult to implement correctly. Even minor deviations (weak random number generation, incomplete sanitization, race conditions in session management) can create complete security bypasses. Always use battle-tested libraries maintained by security experts.

## Common Pitfalls

### Pitfall 1: Static Page Generation with Nonce CSP
**What goes wrong:** CSP nonces are generated at build time instead of per-request, causing all users to share the same nonce (defeating the security purpose) or framework scripts failing to load with CSP violations.
**Why it happens:** Next.js static optimization and ISR generate pages at build time when no request context exists. The nonce value becomes "frozen" in the static HTML.
**How to avoid:** Force dynamic rendering by using `await connection()` in Server Components or getServerSideProps. Verify all pages using CSP are in the dynamic rendering list.
**Warning signs:** Same nonce value on page refresh, CSP violations in production for framework scripts, pages loading from build output instead of server.

### Pitfall 2: Session Revocation Not Taking Effect
**What goes wrong:** User logs out or changes password, but other devices remain authenticated and can continue making requests.
**Why it happens:** Session validation is cached client-side (in cookies) or server-side (in application memory). Deleting the Redis key doesn't invalidate cached validation results.
**How to avoid:** Always validate session on each API request by checking Redis. Don't cache session validation results. Use connect-redis which validates on every request.
**Warning signs:** Users reporting "still logged in" after password change, revoked sessions showing as active, delayed logout effects.

### Pitfall 3: Development vs Production CSP Differences
**What goes wrong:** CSP works perfectly in development but breaks completely in production, with framework scripts blocked and application failing to load.
**Why it happens:** Development mode requires unsafe-eval for hot reloading and debugging. Production builds have different script injection patterns. Next.js doesn't automatically inject nonces in production without proper middleware setup.
**How to avoid:** Test with production builds locally (`npm run build && npm start`). Use CSP report-only mode initially in production. Include both report-uri and report-to directives for debugging.
**Warning signs:** "Refused to execute inline script" errors in production, blank pages in production, working dev build but broken production build.

### Pitfall 4: SVG XSS via Incomplete Sanitization
**What goes wrong:** SVG uploads execute JavaScript despite sanitization, leading to XSS attacks that steal sessions or perform actions as the user.
**Why it happens:** SVG XSS vectors are extremely diverse: `<script>` tags, `onload`/`onclick` handlers, `<foreignObject>` with HTML, `javascript:` URLs in links, `data:` URIs with scripts, external resource loading, CSS injection. Missing even one vector creates a vulnerability.
**How to avoid:** Don't allow SVG uploads at all. Convert existing SVGs to WebP/PNG using Sharp. If SVGs are absolutely required (extremely rare), use DOMPurify v3.3.1+ with jsdom v20+ and strict SVG profile, and serve via `<img>` tag (not inline).
**Warning signs:** Users able to upload SVG files, inline SVG rendering, SVG files served with image/svg+xml MIME type.

### Pitfall 5: Redis KEYS Command in Production
**What goes wrong:** Session revocation or session listing causes Redis to freeze, blocking all requests and causing application-wide outage.
**Why it happens:** KEYS * or KEYS pattern scans the entire keyspace, blocking Redis (single-threaded) until complete. With thousands of sessions, this can take seconds.
**How to avoid:** Never use KEYS in production code. Maintain user-to-session indexes using SET data structure: `user:{userId}:sessions` contains all session IDs for that user. Use SMEMBERS for O(1) retrieval.
**Warning signs:** Slow session operations, Redis latency spikes during logout, timeouts on session management endpoints.

### Pitfall 6: Missing strict-dynamic Directive
**What goes wrong:** Third-party scripts, analytics, or framework code fails to load because dynamically created scripts don't have nonces.
**Why it happens:** Nonces only apply to inline scripts and script tags with the nonce attribute. Scripts created by `document.createElement('script')` don't have nonces.
**How to avoid:** Always include 'strict-dynamic' in script-src directive. This allows nonce-bearing scripts to create additional scripts without nonces.
**Warning signs:** Google Analytics not loading, third-party widgets broken, React hydration errors, "Refused to load script" for dynamically injected scripts.

### Pitfall 7: Nonce Applied to Inline Styles
**What goes wrong:** Development decision to apply nonces only to scripts, leaving inline styles with unsafe-inline, then later discovering inline styles are blocked in strict CSP.
**Why it happens:** Per user requirements, inline styles are allowed (decision: "nonces for scripts, allow inline styles"). This is valid but requires careful CSP configuration.
**How to avoid:** For this project, use `style-src 'self' 'unsafe-inline'` per user's decision. This is acceptable since CSS injection is lower risk than script injection. Document this tradeoff clearly.
**Warning signs:** Styled components or Tailwind styles blocked, rendering issues, missing styles in production.

### Pitfall 8: CSP Violations Not Logged
**What goes wrong:** CSP violations occur in production but go unnoticed, potentially indicating attacks or misconfigurations.
**Why it happens:** No report-uri or report-to endpoint configured, or endpoint doesn't properly log reports.
**How to avoid:** Implement /api/csp-report endpoint, use both report-uri (legacy) and report-to (modern), log to persistent storage or monitoring service, set up alerts for violation patterns.
**Warning signs:** No CSP reports in logs, unknown if policy is working, can't detect attacks or misconfigurations.

## Code Examples

Verified patterns from official sources:

### Force Dynamic Rendering for CSP Pages
```typescript
// Source: https://nextjs.org/docs/app/guides/content-security-policy
import { connection } from 'next/server'

export default async function Page() {
  // Force dynamic rendering (required for nonce-based CSP)
  await connection()

  // Your page content
  return <div>Content</div>
}
```

### Session Destruction (Single Device Logout)
```typescript
// Source: https://redis.io/learn/develop/node/nodecrashcourse/sessionstorage
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.clearCookie('connect.sid') // Default session cookie name
    res.json({ message: 'Logged out successfully' })
  })
})
```

### Sharp SVG Input Handling
```typescript
// Source: https://sharp.pixelplumbing.com/api-output
// Sharp automatically converts SVG to PNG if no format specified
const output1 = await sharp('input.svg').toFile('output.png')

// Explicit WebP conversion
const output2 = await sharp('input.svg')
  .webp({ quality: 80 })
  .toFile('output.webp')

// With metadata removal (default behavior)
const output3 = await sharp(svgBuffer)
  .png()
  .toBuffer() // Returns Buffer for storage
```

### User Session Index Management
```typescript
// Maintain user-to-session mapping using Redis SET
// Add session on login
async function addUserSession(userId: string, sessionId: string) {
  await redisClient.sAdd(`user:${userId}:sessions`, sessionId)
}

// Remove session on single logout
async function removeUserSession(userId: string, sessionId: string) {
  await redisClient.sRem(`user:${userId}:sessions`, sessionId)
}

// Get all active sessions for user
async function getUserSessions(userId: string) {
  return await redisClient.sMembers(`user:${userId}:sessions`)
}

// Clean up session index when session expires
// (connect-redis doesn't do this automatically)
app.use(session({
  store: sessionStore,
  // ... other options
}))

// Hook into session destruction to clean up index
const originalDestroy = sessionStore.destroy.bind(sessionStore)
sessionStore.destroy = function(sessionId, callback) {
  // Find user for this session and remove from their set
  // Note: This requires storing userId in session data
  redisClient.get(`sess:${sessionId}`, (err, data) => {
    if (!err && data) {
      const sessionData = JSON.parse(data)
      if (sessionData.userId) {
        redisClient.sRem(`user:${sessionData.userId}:sessions`, sessionId)
      }
    }
  })

  originalDestroy(sessionId, callback)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Allowlist-based CSP | Nonce + strict-dynamic | CSP Level 3 (2016-2020) | Eliminates need for maintaining domain allowlists, more secure |
| report-uri only | report-uri + report-to | 2020+ | Better reporting format, but need both for compatibility |
| Session in JWT client-side | Session in Redis server-side | Ongoing shift 2020+ | Enables immediate revocation, better for multi-device scenarios |
| SVG sanitization libraries | Convert to raster formats | 2025-2026 trend | Eliminates entire class of XSS vulnerabilities |
| Static pages with hash CSP | Dynamic pages with nonce CSP | Next.js 13+ (2022+) | Better DX with nonces, automatic framework integration |
| connect-redis v6 (callback) | connect-redis v7+ (Promise/async) | v7.0.0 (2022) | Modern async/await API, better TypeScript support |

**Deprecated/outdated:**
- **X-Content-Security-Policy and X-WebKit-CSP headers**: Use standard Content-Security-Policy header only (legacy headers are buggy)
- **happy-dom with DOMPurify**: Known security issues; use jsdom v20+ only for server-side DOMPurify
- **unsafe-eval in production CSP**: Required for dev mode hot reloading, but should never be in production except for specific libraries that absolutely require it
- **Hash-based CSP for dynamic content**: Fragile, breaks on whitespace changes; use nonces for anything that changes
- **Client-side session storage (localStorage)**: No HttpOnly protection, vulnerable to XSS; use Redis server-side storage
- **Older jsdom versions with DOMPurify**: jsdom v19 has known XSS attack vectors that bypass DOMPurify

## Open Questions

Things that couldn't be fully resolved:

1. **Next.js CSP Nonce with Styled Components/Tailwind**
   - What we know: User decision allows inline styles, so style-src 'unsafe-inline' is acceptable
   - What's unclear: Whether specific CSS-in-JS libraries need additional nonce configuration
   - Recommendation: Test with actual CSS framework in use; if issues arise, add nonce to style tags or use styled-component's CSP prop

2. **Session TTL vs Sliding Expiration**
   - What we know: connect-redis supports both fixed TTL and sliding expiration (touch on each request)
   - What's unclear: User preference for session expiration behavior
   - Recommendation: Default to sliding expiration with 7-day maximum (common pattern), make configurable

3. **Rate Limiting Integration with Session Validation**
   - What we know: User wants silent slowdown after failed auth attempts
   - What's unclear: Whether rate limiting should share Redis instance or use separate instance
   - Recommendation: Use same Redis instance with different key prefix (e.g., `ratelimit:`) to reduce infrastructure

4. **SVG Migration Strategy for Existing Assets**
   - What we know: All SVGs must be converted to WebP/PNG
   - What's unclear: Whether to convert at request time (lazy) or batch convert all at once
   - Recommendation: Batch convert all existing assets during deployment, reject future SVG uploads at upload time

5. **CSP Violation Alert Thresholds**
   - What we know: User wants admin alerts for suspicious patterns
   - What's unclear: What constitutes "suspicious" (number of violations, types, sources)
   - Recommendation: Start with logging all violations, analyze patterns, then set thresholds based on baseline

## Sources

### Primary (HIGH confidence)
- Next.js Official Docs - [Content Security Policy Guide](https://nextjs.org/docs/app/guides/content-security-policy)
- OWASP - [Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- MDN - [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- Redis Official - [Scaling an Express Application with Redis as a Session Store](https://redis.io/learn/develop/node/nodecrashcourse/sessionstorage)
- Sharp Official - [Output Options](https://sharp.pixelplumbing.com/api-output/)
- DOMPurify GitHub - [Official Repository](https://github.com/cure53/DOMPurify)
- Google CSP Guide - [Strict CSP](https://csp.withgoogle.com/docs/strict-csp.html)

### Secondary (MEDIUM confidence)
- content-security-policy.com - [strict-dynamic directive](https://content-security-policy.com/strict-dynamic/)
- web.dev - [Mitigate XSS with Strict CSP](https://web.dev/articles/strict-csp)
- npm - [connect-redis package](https://www.npmjs.com/package/connect-redis)
- Redis.io - [Cache Invalidation](https://redis.io/glossary/cache-invalidation/)
- Medium - [Session Management with Redis](https://medium.com/@20011002nimeth/session-management-with-redis-a21d43ac7d5a)
- SVG Genie - [SVG Security Best Practices](https://www.svggenie.com/blog/svg-security-best-practices)

### Tertiary (LOW confidence)
- GitHub Discussions - Various Next.js CSP implementation discussions (noted pitfalls and community workarounds)
- DEV Community articles - Redis caching patterns and session management (2025-2026 patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-documented with official sources and version information verified
- Architecture: HIGH - Patterns sourced from official Next.js docs, Redis.io tutorials, and OWASP guidelines
- Pitfalls: HIGH - Sourced from official documentation warnings, OWASP cheat sheet, and verified GitHub issue discussions

**Research date:** 2026-01-22
**Valid until:** 2026-02-21 (30 days - stable ecosystem, but security best practices evolve)

**Notes:**
- CSP Level 3 (strict-dynamic, nonces) is now widely supported (Chrome 52+, Firefox 52+, Safari 15.4+, Edge 79+)
- Recent Angular CVE-2026-22610 demonstrates ongoing SVG XSS risks, validating decision to convert rather than sanitize
- connect-redis v9.x is current stable version with modern async/await API
- Sharp library has native SVG support with automatic PNG conversion fallback
- User decisions from CONTEXT.md incorporated: nonces for scripts, inline styles allowed, block all SVGs, server-side validation
