# Phase 29: Stabilization - Research

**Researched:** 2026-01-21
**Domain:** Testing, Security Fixes, Bug Resolution
**Confidence:** HIGH

## Summary

This research investigates the testing infrastructure, v0.5.0 feature files requiring tests, security vulnerabilities from CODE_REVIEW_04.MD, and known bugs for Phase 29 stabilization. The codebase has an established Vitest testing setup with 26 existing test files using two distinct patterns: (1) proper unit tests with database mocking for authorization helpers and server actions, and (2) source code validation tests that check implementation patterns without executing logic.

The security findings from CODE_REVIEW_04.MD reveal 1 HIGH, 13 MEDIUM, and 7 LOW severity issues concentrated in socket handlers (lacking authorization checks) and server actions (missing organization scoping). The user status bug (BUG-26-01) requires investigation of the component-to-action data flow.

**Primary recommendation:** Use the established database mocking pattern for unit tests, add authorization checks to vulnerable socket handlers by importing the existing `authz.ts` helpers, and fix security vulnerabilities before writing feature tests.

## Existing Test Infrastructure

### Test Framework Setup

| Component | Configuration | Location |
|-----------|--------------|----------|
| Framework | Vitest 4.0.17 | `vitest.config.ts` |
| Environment | jsdom (React components) | `vitest.config.ts:9` |
| Test Location | `src/**/__tests__/**/*.test.ts`, `tests/**/*.test.ts` | `vitest.config.ts:10-14` |
| Setup File | `vitest.setup.ts` | Global mocks |
| Coverage | Not configured | - |

### Existing Test Files (26 total)

**Socket Handler Tests:**
- `src/server/socket/__tests__/authz.test.ts` - Authorization helpers (proper mocking)
- `src/server/socket/__tests__/message-handlers.test.ts` - Source validation
- `src/server/socket/__tests__/thread-handlers.test.ts` - Source validation
- `src/server/socket/__tests__/reaction-handlers.test.ts`
- `src/server/socket/__tests__/notification-handlers.test.ts`
- `src/server/socket/__tests__/unread-handlers.test.ts`
- `src/server/socket/__tests__/presence-handlers.test.ts`

**Server Action Tests:**
- `src/lib/actions/__tests__/channels.test.ts` - Database mocking pattern
- `src/lib/actions/__tests__/conversations.test.ts`
- `src/lib/actions/__tests__/search.test.ts`

**API Route Tests:**
- `src/app/api/auth/__tests__/password-reset.test.ts`
- `src/app/api/auth/__tests__/lockout.test.ts`
- `src/app/api/channels/__tests__/pins.test.ts`
- `src/app/api/channels/__tests__/notifications.test.ts`
- `src/app/api/upload/avatar/__tests__/route.test.ts`
- `src/app/api/admin/__tests__/audit-logs.test.ts`
- `src/app/api/admin/__tests__/export.test.ts`
- `src/app/api/push/__tests__/*.test.ts` (3 files)

**Library Tests:**
- `src/lib/__tests__/mentions.test.ts`
- `src/lib/__tests__/audit.test.ts`
- `src/lib/__tests__/offline-queue.test.ts`
- `src/lib/__tests__/message-cache.test.ts`
- `src/lib/push/__tests__/vapid.test.ts`
- `src/lib/push/__tests__/send.test.ts`

**Concurrency Tests:**
- `tests/concurrency/message-sequence.test.ts`
- `tests/concurrency/reaction-toggle.test.ts`
- `tests/concurrency/idempotency.test.ts`

### Established Mocking Patterns

**Pattern 1: Database Mocking (channels.test.ts - RECOMMENDED)**
```typescript
// Mock next/headers and next/cache
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Mock database with chainable methods
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      members: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      channels: { findFirst: (...args: unknown[]) => mockFindFirst(...args), findMany: (...args: unknown[]) => mockFindMany(...args) },
      // ... other tables
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Setup default authenticated state
beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-123", name: "Test User", email: "test@example.com" },
  });
});
```

**Pattern 2: Source Validation (thread-handlers.test.ts)**
```typescript
// Reads source file and checks for expected patterns
it("verifies channel membership for replies in channels", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const sourcePath = path.resolve(__dirname, "../handlers/thread.ts");
  const source = fs.readFileSync(sourcePath, "utf-8");

  expect(source).toContain("isChannelMember");
  expect(source).toContain("Not authorized to reply in this channel");
});
```

**Pattern 3: Chainable Mock (authz.test.ts)**
```typescript
// Type-safe mock for Drizzle chain
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
});

// In test
mockDb.limit.mockResolvedValue([{ id: "membership-id" }]);
const result = await isChannelMember("user-123", "channel-456");
expect(result).toBe(true);
```

**Pattern 4: BullMQ Queue Mocking (needed for workers)**
```typescript
// Mock BullMQ queue
vi.mock("@/server/queue/scheduled-message.queue", () => ({
  scheduledMessageQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    getJob: vi.fn(),
  },
}));
```

## v0.5.0 Features Requiring Tests

### Server Actions (by phase)

| Phase | Feature | File | Key Functions to Test |
|-------|---------|------|----------------------|
| 24 | Typing | `socket/handlers/typing.ts` | Authorization needed (M-7) |
| 24 | Archiving | `actions/channel.ts` | Archive/unarchive authorization |
| 25 | Categories | `actions/channel-category.ts` | CRUD + admin validation |
| 25 | BullMQ Workers | `workers/*.ts` | Job processing logic |
| 25 | Scheduled Messages | `actions/scheduled-message.ts` | Create, update, cancel, send-now |
| 26 | Reminders | `actions/reminder.ts` | Create, snooze, complete, cancel |
| 26 | Bookmarks | `actions/bookmark.ts` | Toggle, get, remove |
| 26 | User Status | `actions/user-status.ts` | Set, clear, get (BUG-26-01) |
| 27 | Link Previews | `actions/link-preview.ts` | Authorization needed (M-10) |
| 27 | Custom Emoji | `actions/custom-emoji.ts` | Get, delete permissions |
| 27 | User Groups | `actions/user-group.ts` | CRUD + authorization (M-9) |
| 28 | Guests | `actions/guest.ts` | Invite, redeem, remove, extend |
| 28 | Analytics | `actions/analytics.ts` | Dashboard data retrieval |

### Socket Handlers (requiring authorization fixes)

| Handler | File | Security Finding | Fix Required |
|---------|------|------------------|--------------|
| Notes | `handlers/notes.ts` | H-1: No auth on subscribe/broadcast | Add isChannelMember/isOrganizationMember checks |
| Typing | `handlers/typing.ts` | M-7: Broadcasts without auth | Verify room membership before broadcast |
| Presence | `socket/index.ts:188` | M-1: No org membership check | Validate org membership in presence:fetch |
| Thread | `handlers/thread.ts` | M-2, M-3, M-11 | Rate limits, pagination, retry logic |

### BullMQ Workers

| Worker | File | Test Focus |
|--------|------|------------|
| Scheduled Message | `workers/scheduled-message.worker.ts` | Job processing, status transitions, broadcast |
| Reminder | `workers/reminder.worker.ts` | Status update, socket emit, push notification |
| Status Expiration | `workers/status-expiration.worker.ts` | Auto-clear status |
| Link Preview | `workers/link-preview.worker.ts` | URL fetching, metadata extraction |
| Guest Expiration | `workers/guest-expiration.worker.ts` | Soft-lock then removal |

## Security Findings Analysis

### HIGH Severity (Must Fix)

**H-1: Notes socket rooms lack authorization checks**
- **Location:** `src/server/socket/handlers/notes.ts:29`, `:62`
- **Vulnerability:** Any authenticated user can join arbitrary channel note rooms and receive update metadata, or broadcast spoofed updates
- **Fix:** Import and use `isChannelMember`, `isOrganizationMember` from `authz.ts`

```typescript
// Fix pattern:
socket.on("note:subscribe", async (data) => {
  const { channelId, workspaceId } = data;

  if (channelId) {
    const isMember = await isChannelMember(userId, channelId);
    if (!isMember) {
      socket.emit("error", { message: "Not authorized" });
      return;
    }
    socket.join(getNoteChannelRoom(channelId));
  }
  // ... similar for workspaceId with isOrganizationMember
});
```

### MEDIUM Severity (Fix in Phase)

| ID | Location | Fix Pattern |
|----|----------|-------------|
| M-1 | `socket/index.ts:188` | Add `isOrganizationMember` check before `presence:fetch` |
| M-2 | `handlers/thread.ts:73` | Use `insertMessageWithRetry` pattern from message.ts |
| M-3 | `handlers/thread.ts:16` | Import `MAX_MESSAGE_LENGTH` and rate limiter from message.ts |
| M-7 | `handlers/typing.ts:25-63` | Check `isChannelMember`/`isConversationParticipant` before broadcast |
| M-8 | `actions/user-status.ts:138-143` | Add session check and org membership verification |
| M-9 | `actions/user-group.ts:346-365` | Verify requester org membership before returning members |
| M-10 | `actions/link-preview.ts:24-49` | Check message channel/DM membership before returning previews |
| M-11 | `handlers/thread.ts:215-270` | Add pagination (limit + cursor) to getReplies |
| M-12 | `socket/index.ts:188-204`, `handlers/unread.ts:401-427` | Cap array sizes (e.g., max 100 IDs) |
| M-13 | `handlers/notification.ts:375-412` | Clamp limit (max 100), batch channel queries |

### LOW Severity (Evaluate case-by-case per CONTEXT.md)

| ID | Issue | Quick Fix? |
|----|-------|------------|
| L-1 | Audit log reads entire file | NO - requires streaming rewrite |
| L-2 | Admin export N+1 | NO - requires job-based export |
| L-3 | Rate limit per-node only | NO - requires Redis rate limiter |
| L-4 | Group handle lookup unauthed | YES - add session + org check |
| L-5 | Personal notes no workspace check | YES - add membership validation |
| L-6 | Pins API N+1 lookups | YES - use inArray query |
| L-7 | Notification N+1 settings | YES - batch fetch settings |

**Recommendation:** L-4, L-5, L-6, L-7 are quick fixes (add validation/batch queries). L-1, L-2, L-3 defer to future.

## Bug Investigation

### BUG-26-01: User Status Not Persisting

**Symptoms:** User status not persisting after save
**Affected Requirements:** STAT-02, STAT-03, STAT-05, STAT-06

**Code Flow Analysis:**
1. `StatusEditor.handleSave()` calls `setUserStatus(input)` (line 49-54)
2. `setUserStatus` in `user-status.ts` does upsert (lines 65-98)
3. Calls `revalidatePath("/")` after save

**Potential Issues:**
1. **Component state not refreshed:** `StatusEditor` receives `currentStatus` as prop but may not re-render after save
2. **Cache invalidation:** `revalidatePath("/")` may be too broad
3. **Date handling:** `expiresAt` passed as `undefined` when "Don't clear" selected (line 52) - but action handles this correctly
4. **DND default:** When no existing status, `dndEnabled` defaults to `false` (correct)

**Investigation Required:**
- Check how `currentStatus` is fetched and passed to `StatusEditor`
- Verify parent component re-fetches after save
- Check if the status is actually saved to DB (add logging)

**Test Strategy:**
```typescript
// Test that setUserStatus actually persists
it("persists status to database", async () => {
  mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
  mockFindFirst.mockResolvedValueOnce(null); // No existing status

  const mockReturning = vi.fn().mockResolvedValue([{ id: "status-1", emoji: "..." }]);
  mockInsert.mockReturnValue({
    values: () => ({ returning: mockReturning }),
  });

  await setUserStatus({ emoji: "...", text: "test", dndEnabled: true });

  expect(mockInsert).toHaveBeenCalled();
  expect(mockReturning).toHaveBeenCalled();
});
```

### UI Bugs (from CONTEXT.md)

**Fix channel category drag-drop and management:**
- Investigate `channel-category.ts` `reorderCategories` and `reorderChannelsInCategory`
- Check drag-drop component for state sync issues

**Fix typing bar layout - excessive whitespace:**
- CSS/layout issue in typing indicator component
- Todo exists: `.planning/todos/pending/2026-01-21-fix-typing-bar-layout-whitespace.md`

## Architecture Patterns

### Test Organization

```
src/
├── lib/
│   ├── actions/
│   │   ├── scheduled-message.ts
│   │   └── __tests__/
│   │       └── scheduled-message.test.ts
│   └── __tests__/
│       └── mentions.test.ts
├── server/
│   └── socket/
│       ├── handlers/
│       │   ├── notes.ts
│       │   └── typing.ts
│       ├── authz.ts
│       └── __tests__/
│           ├── notes-handlers.test.ts
│           └── authz.test.ts
└── workers/
    └── __tests__/
        └── scheduled-message.worker.test.ts
```

### Security Fix Pattern

All socket handlers should follow this authorization pattern:

```typescript
// Pattern for socket event handlers
socket.on("some:event", async (data) => {
  const userId = socket.data.userId;

  // 1. Validate required data
  if (!data.targetId) {
    socket.emit("error", { message: "Missing target" });
    return;
  }

  // 2. Check authorization
  if (data.channelId) {
    const isMember = await isChannelMember(userId, data.channelId);
    if (!isMember) {
      socket.emit("error", { message: "Not authorized" });
      return;
    }
  } else if (data.conversationId) {
    const isParticipant = await isConversationParticipant(userId, data.conversationId);
    if (!isParticipant) {
      socket.emit("error", { message: "Not authorized" });
      return;
    }
  }

  // 3. Proceed with operation
  // ...
});
```

### Test Pattern for Security Fixes

```typescript
describe("Handler Authorization", () => {
  it("rejects unauthorized users", async () => {
    // Mock unauthorized
    mockDb.limit.mockResolvedValue([]); // No membership

    // Action should emit error
    // Source validation: expect(source).toContain("isChannelMember")
  });

  it("accepts authorized users", async () => {
    // Mock authorized
    mockDb.limit.mockResolvedValue([{ id: "member-1" }]);

    // Action should succeed
  });
});
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Socket authorization | `authz.ts` helpers | Already exists, tested, consistent |
| Rate limiting | `rate-limiter-flexible` | Already used in message.ts |
| Date manipulation | `date-fns` | Already in dependencies |
| Queue job scheduling | BullMQ patterns | Already established in workers |
| Unique ID generation | `nanoid` | Already in dependencies |

## Common Pitfalls

### Pitfall 1: Test Isolation
**What goes wrong:** Tests share mock state and fail intermittently
**Prevention:** Always call `vi.clearAllMocks()` in `beforeEach`

### Pitfall 2: Drizzle Chain Mocking
**What goes wrong:** Mock chain breaks mid-query
**Prevention:** Ensure each method in chain `.mockReturnThis()` except terminal

### Pitfall 3: Async Authorization Bypass
**What goes wrong:** Authorization check runs after operation starts
**Prevention:** Always `await` authorization helpers before proceeding

### Pitfall 4: Source Validation Tests Are Brittle
**What goes wrong:** Refactoring code changes strings, tests fail
**Prevention:** Use pattern matching, not exact strings. Or prefer proper mocking.

### Pitfall 5: Worker Tests Without Queue Mocking
**What goes wrong:** Tests try to connect to real Redis
**Prevention:** Mock `getQueueConnection` and queue methods

## Code Examples

### Server Action Test (RECOMMENDED)

```typescript
// Source: src/lib/actions/__tests__/channels.test.ts (existing pattern)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScheduledMessage, cancelScheduledMessage } from "../scheduled-message";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
vi.mock("@/db", () => ({
  db: {
    query: {
      channelMembers: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      scheduledMessages: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: vi.fn(),
  },
}));

vi.mock("@/server/queue/scheduled-message.queue", () => ({
  scheduledMessageQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    getJob: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

describe("Scheduled Message Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123" },
    });
  });

  describe("createScheduledMessage", () => {
    it("creates message with valid channel membership", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1" }); // channel membership

      const scheduled = { id: "sm-1", content: "hello", status: "pending" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([scheduled]) }),
      });

      const result = await createScheduledMessage({
        content: "hello",
        scheduledFor: new Date(Date.now() + 60000),
        channelId: "ch-1",
      });

      expect(result.id).toBe("sm-1");
    });

    it("rejects non-member", async () => {
      mockFindFirst.mockResolvedValueOnce(null); // no membership

      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Not a member of this channel");
    });

    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
```

### Security Fix Test

```typescript
// Source: Pattern for testing security fixes
describe("Notes Handler Authorization", () => {
  it("requires channel membership for channel note subscription", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const sourcePath = path.resolve(__dirname, "../handlers/notes.ts");
    const source = fs.readFileSync(sourcePath, "utf-8");

    // After fix, source should contain authorization check
    expect(source).toContain("isChannelMember");
    expect(source).toContain("Not authorized");
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Testcontainers | PGlite in-memory | 2024/2025 | Faster tests, no Docker |
| Manual mocks | Chainable mock patterns | Established | Consistent test setup |
| Source validation | Proper unit tests | Ongoing | More reliable, less brittle |

## Open Questions

1. **PGlite Migration:** Should we migrate from mocking to PGlite for integration tests?
   - What we know: PGlite is current best practice for Drizzle testing
   - What's unclear: Migration effort vs. value
   - Recommendation: Keep mocking for unit tests, consider PGlite for integration tests in future

2. **BUG-26-01 Root Cause:** Is it component state, cache invalidation, or DB?
   - What we know: Code flow looks correct
   - What's unclear: Where the disconnect happens
   - Recommendation: Add logging/debugging to trace the issue

## Sources

### Primary (HIGH confidence)
- Existing test files in `src/**/__tests__/` - Established patterns
- `vitest.config.ts` - Framework configuration
- `vitest.setup.ts` - Global mocks
- `CODE_REVIEW_04.MD` - Security findings

### Secondary (MEDIUM confidence)
- [drizzle-vitest-pg](https://github.com/rphlmr/drizzle-vitest-pg) - PGlite testing pattern
- [Vitest Drizzle testing tutorial](https://github.com/drizzle-team/drizzle-orm/discussions/4216) - In-memory Postgres

### Tertiary (LOW confidence)
- Web search for testing patterns - General guidance

## Metadata

**Confidence breakdown:**
- Test infrastructure: HIGH - Examined actual codebase
- Security fixes: HIGH - CODE_REVIEW_04.MD is authoritative
- Bug analysis: MEDIUM - Code looks correct, requires debugging
- Testing patterns: HIGH - Verified from existing tests

**Research date:** 2026-01-21
**Valid until:** 60 days (stable domain, established patterns)
