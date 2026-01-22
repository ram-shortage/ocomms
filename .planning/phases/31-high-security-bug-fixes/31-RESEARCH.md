# Phase 31: High Security + Bug Fixes - Research

**Researched:** 2026-01-22
**Domain:** Security hardening, real-time event protection, content sanitization, audit integrity
**Confidence:** HIGH

## Summary

Phase 31 combines high-severity security hardening with user-facing bug fixes. The security work focuses on five distinct attack surfaces: rapid-fire Socket.IO events (rate limiting), Unicode-based visual spoofing (content sanitization), authorization boundary violations (channel notes, data export), and audit log tampering (cryptographic integrity).

The standard approach uses the existing rate-limiter-flexible library (already in package.json) for Socket.IO events, isomorphic-dompurify for HTML sanitization (works in both SSR and client contexts), Node.js native crypto for HMAC hash chains, and simple regex-based Unicode control character filtering. Bug fixes use standard responsive CSS techniques with Playwright for visual regression prevention.

User decisions from CONTEXT.md lock in key behaviors: lenient rate limits with toast warnings, global Socket.IO bucket (not per-event), visible placeholder (□) for sanitized Unicode, hash chain for audit integrity, and fail-closed authorization checks. These are not alternatives to explore but requirements to implement.

**Primary recommendation:** Use established libraries for security-critical operations (rate-limiter-flexible, isomorphic-dompurify, crypto.timingSafeEqual) rather than custom implementations. Focus on the specific Unicode ranges (C0/C1 controls, zero-width chars, RTL override) that enable real attacks documented in 2025-2026.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rate-limiter-flexible | 9.0.1 (installed) | Socket.IO rate limiting | Official Socket.IO FAQ recommendation, proven atomic operations, 0.7ms response time |
| isomorphic-dompurify | 2.35.0+ | HTML sanitization (SSR+client) | Wraps DOMPurify with jsdom for Node.js, handles SSR, 1.2M weekly downloads |
| Node.js crypto | Built-in | HMAC-SHA256 hash chains | Native, no dependencies, crypto.timingSafeEqual prevents timing attacks |
| Sonner | 2.0.7 (installed) | Toast notifications | Already used in project (layout.tsx), React 19 compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright | Latest in devDeps | Visual regression tests | Vitest already configured, add Playwright for snapshot testing |
| Unicode regex | Native JS | Control char filtering | Simple `/[\u0000-\u001F\u007F\u0080-\u009F]/g` pattern, no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| isomorphic-dompurify | sanitize-html | sanitize-html is larger (66kb vs 6.6kb), can't prevent mXSS attacks (string-based, not DOM-based) |
| rate-limiter-flexible | Custom middleware | Custom solutions miss race conditions, lack atomic operations, reinvent token bucket logic |
| crypto.timingSafeEqual | String comparison | Direct string/buffer comparison leaks timing info, enables brute-force attacks |

**Installation:**
```bash
npm install isomorphic-dompurify
# Playwright optional - only if visual regression tests desired
npm install -D @playwright/test
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server/socket/
│   ├── middleware/
│   │   ├── auth.ts              # Existing
│   │   └── rate-limit.ts        # NEW: Socket.IO rate limiter
│   └── handlers/                # Existing handlers
├── lib/
│   ├── sanitize.ts              # NEW: Unicode + HTML sanitization
│   └── audit-integrity.ts       # NEW: Hash chain HMAC functions
└── app/api/admin/
    └── audit-logs/              # Add integrity verification
```

### Pattern 1: Socket.IO Rate Limiting (Per-Socket Limiter)
**What:** Global rate limiter applied to all socket events via middleware
**When to use:** Required for SEC2-04 - protecting reaction, typing, presence, thread events
**Example:**
```typescript
// Source: https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example
import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { Socket } from 'socket.io';

const rateLimiter = new RateLimiterMemory({
  points: 30,      // 30 events per duration (lenient per user requirement)
  duration: 1,     // 1 second window
  blockDuration: 5 // 5 second cooldown after limit hit
});

// Apply as middleware to all socket events
socket.use(async (event, next) => {
  try {
    // Use socket.data.userId (authenticated user) not IP
    // Prevents issues with multiple users behind same IP
    await rateLimiter.consume(socket.data.userId);
    next();
  } catch (rateLimiterRes) {
    // Send toast warning to client
    socket.emit('rate-limit', {
      message: 'Slow down',
      retryAfter: rateLimiterRes.msBeforeNext
    });
    // Don't call next() - blocks the event
  }
});
```

### Pattern 2: Unicode Control Character Sanitization
**What:** Strip dangerous Unicode characters that enable visual spoofing
**When to use:** Required for SEC2-05 - sanitizing message content before storage
**Example:**
```typescript
// Source: https://unicode.org/reports/tr39/
// Covers attack vectors documented in 2025-2026

// C0 controls (U+0000-U+001F), DEL (U+007F), C1 controls (U+0080-U+009F)
// Exclude safe chars: newline (U+000A), carriage return (U+000D), tab (U+0009)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g;

// Zero-width chars: ZWSP, ZWNJ, ZWJ (used in hidden message attacks)
const ZERO_WIDTH = /[\u200B\u200C\u200D]/g;

// RTL override (enables file extension spoofing, fake URLs)
const RTL_OVERRIDE = /[\u202E]/g;

function sanitizeUnicode(text: string): string {
  return text
    .replace(CONTROL_CHARS, '\u25A1')  // Replace with □ placeholder
    .replace(ZERO_WIDTH, '\u25A1')
    .replace(RTL_OVERRIDE, '\u25A1');
}
```

### Pattern 3: HTML Sanitization for Channel Notes
**What:** Allow safe HTML subset (bold, links, lists) while blocking scripts/styles
**When to use:** Required for SEC2-05 - channel notes rich text content
**Example:**
```typescript
// Source: https://github.com/kkomelin/isomorphic-dompurify
import DOMPurify from 'isomorphic-dompurify';

// Define safe tag allowlist (user decision: bold, links, lists)
const ALLOWED_TAGS = ['b', 'i', 'strong', 'em', 'a', 'p', 'ul', 'ol', 'li', 'br'];
const ALLOWED_ATTR = ['href', 'title'];

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
```

### Pattern 4: Hash Chain for Audit Log Integrity
**What:** Each log entry includes HMAC of (current entry + previous HMAC)
**When to use:** Required for SEC2-07 - tamper detection for audit logs
**Example:**
```typescript
// Source: https://www.cossacklabs.com/blog/audit-logs-security/
import crypto from 'crypto';

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  previousHash: string;
  hash: string;  // HMAC-SHA256 of current entry + previousHash
}

const SECRET = process.env.AUDIT_LOG_SECRET!;

function computeEntryHash(entry: Omit<AuditEntry, 'hash'>, previousHash: string): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    userId: entry.userId,
    action: entry.action,
    previousHash
  });

  return crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('hex');
}

function verifyChain(entries: AuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const computedHash = computeEntryHash(
      {
        id: entry.id,
        timestamp: entry.timestamp,
        userId: entry.userId,
        action: entry.action,
        previousHash: entry.previousHash
      },
      entry.previousHash
    );

    // Use timing-safe comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(entry.hash, 'hex')
    )) {
      return false; // Chain broken - tampering detected
    }
  }
  return true;
}
```

### Pattern 5: Authorization Boundary Enforcement
**What:** Derive organizationId from authenticated user, never from request
**When to use:** Required for SEC2-08 (data export), SEC2-06 (channel notes)
**Example:**
```typescript
// Source: https://thenewstack.io/role-based-access-control-five-common-authorization-patterns/
// Fail-closed pattern - deny if any doubt

// BAD: Uses request body (attacker-controlled)
async function exportData(req: Request) {
  const { organizationId } = await req.json(); // NEVER DO THIS
  const data = await getOrgData(organizationId);
  return data;
}

// GOOD: Derives from authenticated session
async function exportData(req: Request, session: Session) {
  // Get organizationId from user's membership
  const membership = await db.query.organizationMembers
    .findFirst({
      where: eq(organizationMembers.userId, session.user.id)
    });

  if (!membership) {
    // Fail closed - log security event
    await auditLog(AuditEventType.SECURITY_VIOLATION, {
      userId: session.user.id,
      action: 'data_export_no_membership',
      ip: getClientIP(req)
    });
    return new Response('Forbidden', { status: 403 });
  }

  // Use ONLY the derived organizationId
  const data = await getOrgData(membership.organizationId);
  return data;
}
```

### Pattern 6: Visual Regression Testing with Playwright
**What:** Snapshot tests for mobile layout bug fixes (DMs, profile, nav)
**When to use:** Required per CONTEXT.md - prevent regression of bug fixes
**Example:**
```typescript
// Source: https://ashconnolly.com/blog/playwright-visual-regression-testing-in-next
import { test, expect } from '@playwright/test';

test.describe('Mobile layout fixes', () => {
  test.use({
    viewport: { width: 375, height: 667 } // iPhone SE
  });

  test('DMs page loads correctly on mobile', async ({ page }) => {
    await page.goto('/workspace/test/dms');

    // Wait for stable state (avoid animation flakes)
    await page.waitForLoadState('networkidle');

    // Snapshot test
    await expect(page).toHaveScreenshot('mobile-dms.png', {
      maxDiffPixels: 100 // Allow minor rendering differences
    });
  });

  test('Profile page has proper spacing', async ({ page }) => {
    await page.goto('/workspace/test/profile/user-123');

    // Check specific spacing issue
    const backLink = page.locator('[data-testid="profile-back"]');
    const title = page.locator('[data-testid="profile-title"]');

    const backBox = await backLink.boundingBox();
    const titleBox = await title.boundingBox();

    // Verify spacing between elements
    expect(titleBox!.y - (backBox!.y + backBox!.height)).toBeGreaterThan(8);
  });
});
```

### Anti-Patterns to Avoid
- **IP-based rate limiting for authenticated sockets:** Multiple users behind one IP hit shared limit, breaking normal usage
- **String comparison for HMAC verification:** Direct `===` or `Buffer.equals()` leaks timing, enables brute-force
- **Retroactive sanitization:** Don't re-sanitize existing messages, only new ones (per CONTEXT.md decision)
- **Per-event rate limits:** Global bucket is simpler, prevents evasion by spreading across event types
- **Client-side sanitization only:** Always sanitize server-side before storage, client display is defense-in-depth

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting Socket.IO | Custom counter with timestamps | rate-limiter-flexible | Misses race conditions in distributed systems, lacks atomic operations, no block duration support |
| HTML sanitization | Regex-based tag stripping | isomorphic-dompurify | Can't handle mXSS (mutation XSS) attacks, misses attribute-based XSS, breaks on malformed HTML |
| Timing-safe comparison | `hmac1 === hmac2` or `Buffer.equals()` | crypto.timingSafeEqual | Leaks timing info byte-by-byte, enables brute-force attacks on MACs |
| Unicode normalization | Manual Unicode handling | Native `.normalize('NFKC')` | Unicode has 100+ combining characters, normalization forms complex |
| Visual regression testing | Manual screenshot comparison | Playwright built-in `toHaveScreenshot()` | Pixel-perfect diffing, handles rendering differences, built-in retry logic |

**Key insight:** Security primitives (rate limiting, sanitization, cryptographic comparison) have subtle edge cases that lead to vulnerabilities when hand-rolled. Use battle-tested libraries with security audits and CVE tracking.

## Common Pitfalls

### Pitfall 1: Memory Leaks in Per-Socket Rate Limiters
**What goes wrong:** Rate limiter stores state per socket.id/userId, but never cleans up disconnected sockets, causing memory to grow unbounded
**Why it happens:** Socket.IO disconnect events don't automatically trigger cleanup in external rate limiter instances
**How to avoid:** Use RateLimiterMemory with short duration (1 second) so keys auto-expire, OR hook socket disconnect to manually delete limiter keys
**Warning signs:** Memory usage climbing over hours, high number of keys in rate limiter (check `rateLimiter.get(key)` for stale entries)

### Pitfall 2: Flaky Visual Regression Tests
**What goes wrong:** Playwright snapshots differ between CI and local, or between runs, causing tests to fail despite no real changes
**Why it happens:** Different font rendering, animation timing, dynamic timestamps, network-loaded content, GPU differences
**How to avoid:**
- Wait for `networkidle` state before screenshots
- Disable animations in test environment (`prefers-reduced-motion: reduce`)
- Mask dynamic content (timestamps, avatars with query params)
- Use consistent Docker-based CI environment
- Set `maxDiffPixels` threshold to allow minor rendering differences (50-100px)
**Warning signs:** Tests pass locally but fail in CI, screenshots differ by 1-2 pixels in random locations, timestamps visible in snapshots

### Pitfall 3: Unicode Sanitization Breaking Valid Content
**What goes wrong:** Legitimate emoji sequences (👨‍💻) contain zero-width joiners (ZWJ), sanitizing them breaks the emoji into separate characters (👨💻)
**Why it happens:** Zero-width joiner (U+200D) is both legitimate (emoji) and malicious (hidden messages)
**How to avoid:** Only sanitize control characters and ZWSP/ZWNJ, preserve ZWJ (U+200D) for emoji. Alternative: use Unicode grapheme cluster segmentation to preserve valid sequences
**Warning signs:** User reports "broken emoji", family emoji (👨‍👩‍👧‍👦) appear as separate people, skin tone modifiers disappear

### Pitfall 4: Hash Chain Bootstrap Problem
**What goes wrong:** First audit log entry has no previousHash, verification fails or skips first entry
**Why it happens:** Hash chain requires previous hash, but first entry has no predecessor
**How to avoid:** Use constant seed hash for first entry (e.g., HMAC of empty string + organization ID), OR skip verification on first entry if previousHash is null
**Warning signs:** Audit log verification always fails, first entry has empty/null previousHash, tests fail on fresh databases

### Pitfall 5: Authorization Checks After Data Fetch
**What goes wrong:** Code fetches sensitive data, then checks authorization, leaking data via timing or error messages
**Why it happens:** Natural code flow is "fetch, then check", but this exposes existence/non-existence timing
**How to avoid:** Check authorization BEFORE fetching data, use same code path for "not found" and "not authorized" (fail closed)
**Warning signs:** Different response times for non-existent vs unauthorized resources, error messages reveal resource existence ("channel exists but you're not a member")

### Pitfall 6: Rate Limit Bypass via Multiple Sockets
**What goes wrong:** Attacker opens multiple socket connections, each gets separate rate limit, bypassing global limit
**Why it happens:** Rate limiting by socket.id instead of authenticated userId
**How to avoid:** ALWAYS rate limit by `socket.data.userId` (from auth middleware), not `socket.id` or `socket.handshake.address`
**Warning signs:** Rate limit ineffective against determined attackers, seeing multiple socket connections from same user, different socket IDs in logs

## Code Examples

Verified patterns from official sources:

### Client-Side Rate Limit Toast Handler
```typescript
// Source: Project uses Sonner (src/app/layout.tsx line 61)
// https://github.com/emilkowalski/sonner

import { toast } from 'sonner';
import { socket } from '@/lib/socket';

socket.on('rate-limit', (data: { message: string; retryAfter: number }) => {
  // Subtle toast, not blocking (per CONTEXT.md requirement)
  toast.warning(data.message, {
    description: `Please wait ${Math.ceil(data.retryAfter / 1000)}s`,
    duration: 3000
  });
});
```

### Sanitize on Message Creation (Server)
```typescript
// Source: Apply before storage, not retroactively
// https://aws.amazon.com/blogs/security/defending-llm-applications-against-unicode-character-smuggling/

import { sanitizeUnicode } from '@/lib/sanitize';

async function createMessage(content: string, channelId: string, userId: string) {
  // Sanitize BEFORE storage (going forward only, per CONTEXT.md)
  const sanitizedContent = sanitizeUnicode(content);

  const message = await db.insert(messages).values({
    content: sanitizedContent,
    channelId,
    userId,
    createdAt: new Date()
  }).returning();

  return message;
}
```

### Channel Notes Authorization Check
```typescript
// Source: Fail-closed pattern from CONTEXT.md
// https://thenewstack.io/role-based-access-control-five-common-authorization-patterns/

async function updateChannelNotes(
  channelId: string,
  content: string,
  userId: string
) {
  // Check channel membership BEFORE fetching/updating
  const membership = await db.query.channelMembers.findFirst({
    where: and(
      eq(channelMembers.channelId, channelId),
      eq(channelMembers.userId, userId)
    )
  });

  // Fail closed - deny if ANY doubt (per CONTEXT.md)
  if (!membership) {
    await auditLog(AuditEventType.SECURITY_VIOLATION, {
      userId,
      channelId,
      action: 'channel_notes_unauthorized'
    });
    throw new Error('Not authorized'); // Same error for not found vs unauthorized
  }

  // Sanitize HTML before storage
  const sanitizedContent = sanitizeHtml(content);

  await db.update(channels)
    .set({ notes: sanitizedContent })
    .where(eq(channels.id, channelId));
}
```

### Audit Log Creation with Hash Chain
```typescript
// Source: Hash chain pattern from Cossack Labs
// https://www.cossacklabs.com/blog/audit-logs-security/

import { computeEntryHash } from '@/lib/audit-integrity';

async function createAuditEntry(
  action: string,
  userId: string,
  metadata: Record<string, unknown>
) {
  // Get most recent entry to link chain
  const previousEntry = await db.query.auditLogs.findFirst({
    orderBy: [desc(auditLogs.timestamp)],
    columns: { hash: true }
  });

  const entry = {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    userId,
    action,
    metadata: JSON.stringify(metadata),
    previousHash: previousEntry?.hash || '' // Empty string for first entry
  };

  const hash = computeEntryHash(entry, entry.previousHash);

  await db.insert(auditLogs).values({
    ...entry,
    hash
  });
}
```

### Audit Log Verification in Viewer
```typescript
// Source: Display warning banner if tampering detected (per CONTEXT.md)
// No admin alert, just visual indicator

import { verifyChain } from '@/lib/audit-integrity';

async function getAuditLogs(organizationId: string) {
  const entries = await db.query.auditLogs.findMany({
    where: eq(auditLogs.organizationId, organizationId),
    orderBy: [asc(auditLogs.timestamp)]
  });

  const isValid = verifyChain(entries);

  return {
    entries,
    isValid, // Frontend shows warning banner if false
    warning: isValid ? null : 'Audit log integrity check failed. Possible tampering detected.'
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String-based HTML sanitization (sanitize-html) | DOM-based sanitization (DOMPurify/isomorphic-dompurify) | ~2019-2020 | DOM-based can detect and prevent mXSS attacks that string manipulation misses |
| IP-based Socket.IO rate limiting | User-ID based limiting | Ongoing issue (2015-2026) | IP limiting breaks for users behind NAT/corporate proxies |
| Direct string comparison for HMAC | crypto.timingSafeEqual | Node.js v6.6.0 (2016) | Prevents timing attacks on authentication tokens |
| Per-event Socket.IO rate limits | Global/aggregate limits | Recent trend (2024-2025) | Prevents evasion by spreading spam across event types |
| Zero-width character blocking entirely | Preserve ZWJ for emoji, block ZWSP/ZWNJ | 2025-2026 emoji updates | Balances security with legitimate emoji use |

**Deprecated/outdated:**
- **socket.io-ratelimiter package (npm)**: Last published 5 years ago, not compatible with Socket.IO v4, use rate-limiter-flexible instead
- **DOMPurify in Node.js without jsdom wrapper**: Doesn't work server-side, use isomorphic-dompurify which bundles jsdom
- **Manual Buffer.compare() for HMAC verification**: Vulnerable to timing attacks, use crypto.timingSafeEqual (available since Node 6)

## Open Questions

Things that couldn't be fully resolved:

1. **Playwright vs Percy for visual regression**
   - What we know: Playwright has built-in snapshot testing, Percy adds AI-powered noise filtering and cross-browser cloud testing
   - What's unclear: Whether Percy's $199/month cost is justified for this phase (5 bug fixes)
   - Recommendation: Start with Playwright built-in (free, already in devDeps), evaluate Percy if snapshot flakiness becomes problem

2. **Exact rate limit numbers within "lenient" guidance**
   - What we know: User wants "allow bursts, only catch extreme abuse (e.g., 30 events/sec)"
   - What's unclear: Whether 30/sec is per-user target or just example; what constitutes "extreme"
   - Recommendation: Start with 30 points/second per user (matches example), tune based on real abuse patterns in monitoring

3. **ZWJ preservation for emoji sequences**
   - What we know: Zero-Width Joiner (U+200D) is needed for family emoji, skin tones, but also used in hidden message attacks
   - What's unclear: Whether to preserve ALL ZWJ occurrences or only in valid emoji sequences (requires complex Unicode segmentation)
   - Recommendation: Start by preserving ZWJ (don't sanitize U+200D), only sanitize if actual attacks observed using it

4. **Visual regression test threshold**
   - What we know: `maxDiffPixels` needed to avoid flakiness from minor rendering differences
   - What's unclear: What pixel count allows CI/local differences but catches real regressions
   - Recommendation: Start with 100px threshold, review first failures to tune (too high = miss regressions, too low = flaky tests)

## Sources

### Primary (HIGH confidence)
- [Socket.IO Official FAQ - Rate Limiting](https://socket.io/docs/v3/faq/) - Recommends rate-limiter-flexible
- [rate-limiter-flexible GitHub Wiki](https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example) - Socket.IO implementation patterns
- [Node.js Crypto Module Documentation](https://nodejs.org/api/crypto.html) - timingSafeEqual usage
- [isomorphic-dompurify npm](https://www.npmjs.com/package/isomorphic-dompurify) - SSR-safe HTML sanitization
- [Unicode Control Characters (Wikipedia)](https://en.wikipedia.org/wiki/Unicode_control_characters) - C0/C1 ranges
- [Cossack Labs: Audit Log Security](https://www.cossacklabs.com/blog/audit-logs-security/) - Hash chain implementation

### Secondary (MEDIUM confidence)
- [DOMPurify vs sanitize-html comparison](https://dompurify.com/what-are-the-key-differences-between-dompurify-and-other-html-sanitization-libraries/) - Performance, security comparison
- [AWS: Defending Against Unicode Character Smuggling](https://aws.amazon.com/blogs/security/defending-llm-applications-against-unicode-character-smuggling/) - 2025 security patterns
- [MITRE ATT&CK: Right-to-Left Override](https://attack.mitre.org/techniques/T1036/002/) - RTL attack documentation
- [Playwright Visual Testing Guide](https://ashconnolly.com/blog/playwright-visual-regression-testing-in-next) - Next.js implementation
- [The New Stack: RBAC Authorization Patterns](https://thenewstack.io/role-based-access-control-five-common-authorization-patterns/) - Authorization boundaries
- [BrowserStack: Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) - Flaky test prevention

### Tertiary (LOW confidence)
- [Socket.IO Memory Leak Issues (GitHub)](https://github.com/socketio/socket.io/issues/3477) - Community reports, not official resolution
- WebSearch results on visual regression testing - Multiple sources agreeing, but not official Playwright docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in official docs, version numbers confirmed in package.json or npm
- Architecture: HIGH - Patterns from official library documentation and security research papers (Cossack Labs, AWS)
- Pitfalls: MEDIUM - Based on GitHub issues, community experiences, and documented attack patterns (MITRE)
- Code examples: HIGH - All examples adapted from official documentation or verified implementation guides

**Research date:** 2026-01-22
**Valid until:** 2026-02-21 (30 days) - Security libraries stable, but check for CVEs in isomorphic-dompurify and rate-limiter-flexible
