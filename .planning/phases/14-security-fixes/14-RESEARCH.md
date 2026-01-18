# Phase 14: Security Fixes - Research

**Researched:** 2026-01-18
**Domain:** Security hardening, authorization scoping, input validation, race conditions
**Confidence:** HIGH

## Summary

Phase 14 addresses security vulnerabilities in the existing codebase. The research covers eight distinct requirements (SECFIX-01 through SECFIX-08), focusing on authorization scoping, fail-closed validation, atomic operations, input limits, rate limiting, and async file I/O.

The codebase already has solid foundations: organization membership checks exist in `authz.ts`, better-auth with rate limiting is configured, and the message schema has unique constraints on sequences. The fixes are incremental improvements to existing patterns rather than new architectural work.

**Primary recommendation:** Apply targeted fixes to existing code paths. Use `rate-limiter-flexible` for Socket.IO message rate limiting, drizzle-orm's `sql` template for atomic sequence increments, and `fs/promises` for async audit logging.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Database ORM | Already in use, supports atomic operations via `sql` template |
| socket.io | ^4.8.3 | Real-time messaging | Already in use for WebSocket communication |
| better-auth | ^1.4.14 | Authentication | Already configured with rate limiting for auth endpoints |
| Next.js | 16.1.3 | Framework | Already provides middleware and error handling patterns |

### To Add
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rate-limiter-flexible | ^9.0.1 | Rate limiting | Socket.IO message rate limiting per user |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rate-limiter-flexible | socket.io-ratelimiter | rate-limiter-flexible is maintained, socket.io-ratelimiter last updated 5 years ago |
| rate-limiter-flexible | Custom implementation | rate-limiter-flexible handles edge cases, sliding windows, memory management |

**Installation:**
```bash
npm install rate-limiter-flexible
```

## Architecture Patterns

### SECFIX-01: @mention Scoping to Organization

**Problem:** Mention autocomplete (`notification.ts` lines 99-124) resolves users by name without organization scoping. A user in Org A could be mentioned in Org B if names match.

**Current flow:**
```
parseMentions() -> notification.ts -> users table lookup by name -> no org filter
```

**Required fix:**
```typescript
// In notification.ts createNotifications()
// Add organizationId parameter and join with members table
const [targetUser] = await db
  .select({ id: users.id })
  .from(users)
  .innerJoin(members, eq(members.userId, users.id))
  .where(
    and(
      eq(users.name, mention.value),
      eq(members.organizationId, organizationId)
    )
  )
  .limit(1);
```

**Client-side scoping:**
The `MentionAutocomplete` component receives `members` prop from `ChannelContent`, which passes channel members. This is already scoped to channel membership. However, the channel page (`page.tsx`) should verify the members list only includes organization members (currently it does via channel membership which implies org membership).

### SECFIX-02: Middleware Fail-Closed

**Problem:** Current middleware (`middleware.ts` line 75-79) fails open:
```typescript
} catch (error) {
  console.error("[Middleware] Session validation error:", error);
  // On error, allow through (fail open for availability)
  return NextResponse.next();
}
```

**Required fix:**
```typescript
} catch (error) {
  console.error("[Middleware] Session validation error:", error);
  // Fail closed - redirect to login on any validation error
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("better-auth.session_token");
  return response;
}
```

### SECFIX-03: Atomic Sequence Increment

**Problem:** Current sequence generation (`message.ts` lines 57-66) has race condition:
```typescript
const [maxSeq] = await db
  .select({ maxSequence: max(messages.sequence) })
  .from(messages)
  .where(condition);
const sequence = (maxSeq?.maxSequence ?? 0) + 1;
// Time gap between SELECT and INSERT allows race
const [newMessage] = await db.insert(messages).values({ ..., sequence });
```

**Required fix - INSERT ... ON CONFLICT with retry:**
```typescript
import { sql } from 'drizzle-orm';

// Use INSERT with subquery for atomic increment
const insertWithSequence = async (retries = 3): Promise<typeof messages.$inferSelect> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const [newMessage] = await db
        .insert(messages)
        .values({
          content,
          authorId: userId,
          channelId: targetType === "channel" ? targetId : null,
          conversationId: targetType === "dm" ? targetId : null,
          sequence: sql`(
            SELECT COALESCE(MAX(sequence), 0) + 1
            FROM messages
            WHERE ${targetType === "channel"
              ? sql`channel_id = ${targetId}`
              : sql`conversation_id = ${targetId}`}
          )`,
        })
        .returning();
      return newMessage;
    } catch (error) {
      // Unique constraint violation - retry
      if (error.code === '23505' && attempt < retries - 1) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to insert message after retries');
};
```

**Why this works:** The unique index on `(channel_id, sequence)` and `(conversation_id, sequence)` from the schema prevents duplicates. The subquery executes atomically within the INSERT.

### SECFIX-04: getChannel Organization Verification

**Problem:** `getChannel()` in `channel.ts` (lines 208-235) checks channel membership for private channels but doesn't verify the requesting user belongs to the channel's organization.

**Current flow:**
```
getChannel(organizationId, slug) -> finds channel -> checks private membership -> returns
```

**Required fix:**
```typescript
export async function getChannel(organizationId: string, slug: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // SECFIX-04: Verify organization membership FIRST
  const isOrgMember = await verifyOrgMembership(session.user.id, organizationId);
  if (!isOrgMember) {
    return null; // Don't reveal channel exists
  }

  const channel = await db.query.channels.findFirst({
    where: and(
      eq(channels.organizationId, organizationId),
      eq(channels.slug, slug)
    ),
    // ... rest of query
  });
  // ... rest of function
}
```

### SECFIX-05: Maximum Message Length

**Decision from CONTEXT.md:** 10,000 characters maximum.

**Server-side enforcement (Socket.IO handler):**
```typescript
const MAX_MESSAGE_LENGTH = 10_000;

async function handleSendMessage(...) {
  const { content } = data;

  // SECFIX-05: Server-side length validation
  if (content.length > MAX_MESSAGE_LENGTH) {
    socket.emit("error", {
      message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      code: "MESSAGE_TOO_LONG"
    });
    callback?.({ success: false });
    return;
  }
  // ... rest of handler
}
```

**Client-side UX (from CONTEXT.md decisions):**
- Allow typing beyond limit but disable send button with warning
- Always-visible character counter ("142/10000" format)
- Red counter only when over limit

### SECFIX-06: Message Rate Limiting

**Decision from CONTEXT.md:**
- Simple message without countdown: "Message rate limit reached. Please wait."
- Display inline below message input
- Disable input while rate-limited

**Server-side implementation with rate-limiter-flexible:**
```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Configure per-user rate limiter
const messageRateLimiter = new RateLimiterMemory({
  points: 10,     // 10 messages
  duration: 60,   // per 60 seconds
});

async function handleSendMessage(...) {
  const userId = socket.data.userId;

  try {
    await messageRateLimiter.consume(userId);
  } catch (rejRes) {
    // Rate limited
    socket.emit("error", {
      message: "Message rate limit reached. Please wait.",
      code: "RATE_LIMITED",
      retryAfter: Math.ceil(rejRes.msBeforeNext / 1000)
    });
    callback?.({ success: false });
    return;
  }
  // ... rest of handler
}
```

### SECFIX-07: NEXT_PUBLIC_APP_URL Usage

**Current state:** The codebase already uses `process.env.NEXT_PUBLIC_APP_URL` in most places:
- `src/lib/auth-client.ts:5` - baseURL
- `src/lib/auth.ts:227` - password reset URL
- `src/lib/auth.ts:351` - invite accept URL
- `src/server/index.ts:21` - CORS origin with fallback

**Potential issue in server/index.ts:**
```typescript
origin: process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`,
```
The fallback could be problematic in production. Verify all URL constructions use the env variable.

### SECFIX-08: Async Audit Logging

**Problem:** Current audit logger uses `fs.appendFileSync` (line 116):
```typescript
// Append synchronously for atomic single-line writes
fs.appendFileSync(logPath, line);
```

**Required fix with fs/promises:**
```typescript
import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function auditLog(data: AuditEventData): Promise<void> {
  try {
    const event: AuditEvent = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    const logsDir = getLogsDir();
    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
    }

    const logPath = path.join(logsDir, getLogFilename());
    const line = JSON.stringify(event) + "\n";

    // Async append - non-blocking
    await appendFile(logPath, line);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
```

**Note:** Since this is fire-and-forget, callers should not await. The function signature changes but call sites using `void auditLog(...)` remain unchanged.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom token bucket | rate-limiter-flexible | Handles memory cleanup, sliding windows, concurrent access |
| Atomic sequences | SELECT then INSERT | Subquery in INSERT + retry | Proper atomic operation with conflict handling |
| Async file writes | Custom queue | fs/promises.appendFile | Node.js optimized, handles buffering |
| Session validation | Custom cookie parsing | better-auth API | Already integrated, handles edge cases |

**Key insight:** These security fixes are about using existing tools correctly, not building new ones.

## Common Pitfalls

### Pitfall 1: Race Condition in Sequence Generation
**What goes wrong:** Two concurrent messages get the same sequence number.
**Why it happens:** SELECT MAX + INSERT is not atomic; gap between operations.
**How to avoid:** Use INSERT with subquery that computes sequence atomically, combined with unique constraint and retry logic.
**Warning signs:** Duplicate sequence numbers in database, messages appearing out of order.

### Pitfall 2: Fail-Open Security
**What goes wrong:** Authentication errors allow unauthenticated access.
**Why it happens:** Catch block defaults to "allow" for availability.
**How to avoid:** Always redirect to login on any validation error. Log the error for debugging.
**Warning signs:** Users accessing protected routes without valid session.

### Pitfall 3: Cross-Organization Data Leakage
**What goes wrong:** User in Org A sees data from Org B.
**Why it happens:** Queries filter by resource ID but don't verify org membership.
**How to avoid:** Always verify organization membership before any data access. Use consistent pattern: check org first, then resource.
**Warning signs:** Users seeing channels/members from other workspaces.

### Pitfall 4: Client-Only Validation
**What goes wrong:** Bypassing UI allows invalid data submission.
**Why it happens:** Only validating in frontend, not server.
**How to avoid:** Server MUST validate all inputs. Client validation is UX only.
**Warning signs:** Messages exceeding limits in database.

### Pitfall 5: Blocking File I/O
**What goes wrong:** Audit logging blocks request processing.
**Why it happens:** Using synchronous file operations on hot paths.
**How to avoid:** Use async fs/promises methods; fire-and-forget pattern.
**Warning signs:** High latency on message sends, CPU spikes.

## Code Examples

### Atomic Sequence with Retry (SECFIX-03)
```typescript
// Source: https://orm.drizzle.team/docs/guides/incrementing-a-value
import { sql } from 'drizzle-orm';

async function insertMessageWithSequence(
  db: typeof import('@/db').db,
  values: { content: string; authorId: string; channelId?: string; conversationId?: string },
  maxRetries = 3
) {
  const { channelId, conversationId } = values;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const condition = channelId
        ? sql`channel_id = ${channelId}`
        : sql`conversation_id = ${conversationId}`;

      const [message] = await db
        .insert(messages)
        .values({
          ...values,
          channelId: channelId ?? null,
          conversationId: conversationId ?? null,
          sequence: sql`(SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE ${condition})`,
        })
        .returning();

      return message;
    } catch (error: any) {
      // PostgreSQL unique violation error code
      if (error.code === '23505' && attempt < maxRetries - 1) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to insert message after retries');
}
```

### Rate Limiter Setup (SECFIX-06)
```typescript
// Source: https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 10 messages per 60 seconds per user
const messageRateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  keyPrefix: 'message',
});

// In socket handler
try {
  await messageRateLimiter.consume(userId);
  // Proceed with message
} catch (rejRes) {
  // rejRes.msBeforeNext = ms until rate limit resets
  socket.emit('error', {
    message: 'Message rate limit reached. Please wait.',
    code: 'RATE_LIMITED',
    retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
  });
  callback?.({ success: false });
  return;
}
```

### Organization-Scoped User Lookup (SECFIX-01)
```typescript
// Find user by name within organization
const [targetUser] = await db
  .select({ id: users.id, name: users.name })
  .from(users)
  .innerJoin(members, eq(members.userId, users.id))
  .where(
    and(
      eq(users.name, mentionValue),
      eq(members.organizationId, organizationId)
    )
  )
  .limit(1);
```

### Async Audit Log (SECFIX-08)
```typescript
// Source: https://nodejs.org/api/fs.html
import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function auditLog(data: AuditEventData): Promise<void> {
  try {
    const event: AuditEvent = { ...data, timestamp: new Date().toISOString() };
    const logsDir = getLogsDir();

    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
    }

    await appendFile(
      path.join(logsDir, getLogFilename()),
      JSON.stringify(event) + '\n'
    );
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fs.appendFileSync | fs/promises.appendFile | Node.js 14+ | Non-blocking I/O |
| SELECT MAX + INSERT | INSERT with subquery | PostgreSQL standard | Atomic sequence generation |
| Fail-open auth | Fail-closed auth | Security best practice | Prevents unauthorized access |

**Deprecated/outdated:**
- None of the approaches in this codebase are deprecated

## Open Questions

Things that couldn't be fully resolved:

1. **Rate limit duration specifics**
   - What we know: CONTEXT.md says "Claude's discretion" for exact duration
   - What's unclear: Optimal messages/minute for good UX vs abuse prevention
   - Recommendation: Start with 10 messages per 60 seconds, adjust based on usage patterns

2. **Error page routing**
   - What we know: CONTEXT.md says redirect to error page with "Go home" button
   - What's unclear: Whether to use Next.js error.tsx or custom error routes
   - Recommendation: Create `/error` page with reason codes; redirect there on auth failures

## Sources

### Primary (HIGH confidence)
- Drizzle ORM documentation - [Incrementing a value](https://orm.drizzle.team/docs/guides/incrementing-a-value)
- Node.js documentation - [File system promises API](https://nodejs.org/api/fs.html)
- rate-limiter-flexible wiki - [Overall example](https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example)
- Codebase analysis - middleware.ts, authz.ts, message.ts, notification.ts, audit-logger.ts

### Secondary (MEDIUM confidence)
- [PostgreSQL race conditions](https://dev.to/mistval/winning-race-conditions-with-postgresql-54gn) - Atomic operations patterns
- [Socket.IO FAQ](https://socket.io/docs/v3/faq/) - rate-limiter-flexible recommendation
- [Advisory locks article](https://firehydrant.com/blog/using-advisory-locks-to-avoid-race-conditions-in-rails/) - Scoped sequence patterns

### Tertiary (LOW confidence)
- None - all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or well-documented
- Architecture: HIGH - Patterns verified against drizzle-orm and Node.js docs
- Pitfalls: HIGH - Based on codebase analysis and security best practices

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable domain)
