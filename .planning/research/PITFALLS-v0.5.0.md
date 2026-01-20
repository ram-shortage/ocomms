# Domain Pitfalls: Team Communication Platform Feature Completeness

**Project:** OComms v0.5.0 - Feature Completeness Milestone
**Domain:** Team communication platform (Slack-like)
**Researched:** 2026-01-20
**Target:** 500+ concurrent users, PostgreSQL + Redis + Socket.IO stack

---

## Executive Summary

This document catalogs common mistakes, security risks, performance traps, and UX pitfalls for implementing 12 features in OComms v0.5.0. Each pitfall includes severity, warning signs, and prevention strategies.

**Critical pitfalls to prioritize:**
1. Link preview SSRF vulnerabilities (security)
2. Custom emoji SVG XSS attacks (security)
3. Guest account isolation failures (security)
4. Typing indicator broadcast storms (performance)
5. Scheduled messages reliability failures (data loss)

---

## Critical Pitfalls

Mistakes that cause security breaches, data loss, or require significant rewrites.

### CRIT-1: Link Preview SSRF Vulnerabilities

**Feature:** Link Previews / Unfurling
**Severity:** CRITICAL (Security)

**What goes wrong:** Server-side URL fetching for link previews allows attackers to probe internal networks, access cloud metadata services (AWS IMDSv1), or send requests to internal services not exposed to the internet.

**Why it happens:** Developers implement link preview by fetching any user-provided URL server-side without validating the destination. The server becomes a proxy for attackers to reach internal resources.

**Consequences:**
- Internal network enumeration and port scanning
- AWS/cloud credential theft via metadata endpoints (169.254.169.254)
- Attacks on internal services (databases, admin panels)
- Microsoft Teams had this vulnerability and declined to fix it

**Warning signs:**
- Link preview works for any URL including localhost, internal IPs
- No timeout or redirect limits on fetches
- Server follows HTTP redirects blindly

**Prevention:**
```typescript
// REQUIRED: URL validation before fetch
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\.169\.254$/,  // AWS metadata
  /^0\./,
  /\.local$/i
];

function isUrlAllowed(url: string): boolean {
  const parsed = new URL(url);
  // Block internal IPs and localhost
  if (BLOCKED_HOSTS.some(pattern => pattern.test(parsed.hostname))) {
    return false;
  }
  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return false;
  }
  return true;
}

// Additional mitigations:
// 1. Set strict timeouts (3-5 seconds)
// 2. Limit redirect follows (max 2-3)
// 3. Block DNS rebinding attacks
// 4. Run fetch in isolated network namespace if possible
```

**Sources:**
- [PortSwigger SSRF Guide](https://portswigger.net/web-security/ssrf)
- [MS Teams SSRF Vulnerability](https://positive.security/blog/ms-teams-1-feature-4-vulns)
- [link-preview-js CVE-2022-25876](https://security.snyk.io/vuln/SNYK-JS-LINKPREVIEWJS-2933520)

---

### CRIT-2: Custom Emoji SVG XSS Attacks

**Feature:** Custom Emoji
**Severity:** CRITICAL (Security)

**What goes wrong:** SVG files uploaded as custom emoji contain embedded JavaScript that executes when rendered in users' browsers, leading to session hijacking, data theft, or malware distribution.

**Why it happens:** SVG is an XML-based format that can contain `<script>` tags, event handlers (onload, onerror), and `<foreignObject>` elements with embedded HTML. Client-side validation is easily bypassed.

**Consequences:**
- Stored XSS affecting all users who view the emoji
- Session cookie theft and account takeover
- Malicious actions performed as victim users
- Spread to all channels where emoji is used

**Warning signs:**
- File type validation only checks extension or Content-Type header
- SVG files served with image/* or text/html MIME type
- No Content Security Policy for uploaded content
- Validation only happens client-side

**Prevention:**
```typescript
// Option 1 (Recommended): Convert SVG to PNG on upload
import sharp from 'sharp';

async function processCustomEmoji(buffer: Buffer, filename: string) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.svg') {
    // Convert SVG to PNG, stripping all scripts
    return await sharp(buffer)
      .resize(64, 64)  // Emoji size
      .png()
      .toBuffer();
  }

  // For other images, validate and resize
  return await sharp(buffer)
    .resize(64, 64)
    .png()
    .toBuffer();
}

// Option 2: Sanitize SVG (less secure, more complex)
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

function sanitizeSvg(svgContent: string): string {
  const window = new JSDOM('').window;
  const purify = DOMPurify(window);
  return purify.sanitize(svgContent, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ['script', 'foreignObject'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
  });
}

// ALWAYS serve user-uploaded content with:
// Content-Type: image/png (or image/jpeg, image/gif)
// Content-Security-Policy: script-src 'none'
// Content-Disposition: inline; filename="emoji.png"
```

**Sources:**
- [Securitum SVG XSS Research](https://research.securitum.com/do-you-allow-to-load-svg-files-you-have-xss/)
- [Ghost CMS SVG XSS Fix](https://github.com/TryGhost/Ghost/pull/19646)
- [SVG XSS Medium Article](https://medium.com/@l_s_/stored-xss-via-svg-file-upload-66b992a5a503)

---

### CRIT-3: Guest Account Data Isolation Failures

**Feature:** Guest Accounts
**Severity:** CRITICAL (Security)

**What goes wrong:** Guest users can access channels, messages, or data from workspaces they shouldn't have access to due to missing or incorrect authorization checks. Logical isolation via tenant_id columns fails at query level.

**Why it happens:** Developers rely on logical isolation (WHERE workspace_id = X) but miss authorization checks in some endpoints, background jobs, or real-time event handlers. The "shared fate" problem in multi-tenant systems.

**Consequences:**
- Cross-workspace data leakage
- Guests accessing internal channels
- Compliance violations (guest sees confidential data)
- Reputational damage and legal liability

**Warning signs:**
- Authorization checks scattered across codebase (not centralized)
- Some endpoints check workspace access, others don't
- Socket.IO events don't verify room membership
- Background jobs process data without re-checking permissions
- No integration tests for cross-tenant scenarios

**Prevention:**
```typescript
// 1. Centralized authorization middleware
interface AuthContext {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  guestChannels?: string[];  // Guests only access specific channels
}

function requireChannelAccess(channelId: string) {
  return async (ctx: Context, next: Next) => {
    const auth = ctx.get('auth') as AuthContext;

    // Guests have explicit channel allowlist
    if (auth.role === 'guest') {
      if (!auth.guestChannels?.includes(channelId)) {
        throw new ForbiddenError('Guest cannot access this channel');
      }
    }

    // All users: verify channel belongs to workspace
    const channel = await db.query.channels.findFirst({
      where: and(
        eq(channels.id, channelId),
        eq(channels.workspaceId, auth.workspaceId)
      )
    });

    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    await next();
  };
}

// 2. Database-level row security (PostgreSQL RLS)
// CREATE POLICY workspace_isolation ON messages
//   USING (workspace_id = current_setting('app.workspace_id')::uuid);

// 3. Socket.IO room verification
io.on('connection', (socket) => {
  socket.on('join:channel', async (channelId) => {
    const canAccess = await verifyChannelAccess(socket.userId, channelId);
    if (!canAccess) {
      socket.emit('error', { code: 'FORBIDDEN' });
      return;
    }
    socket.join(`channel:${channelId}`);
  });
});

// 4. Integration tests for isolation
describe('Guest isolation', () => {
  it('guest cannot access non-assigned channels', async () => {
    const guestToken = await createGuestUser(['channel-1']);
    const response = await api.get('/channels/channel-2/messages')
      .set('Authorization', `Bearer ${guestToken}`);
    expect(response.status).toBe(403);
  });
});
```

**Sources:**
- [Multi-Tenant Security Best Practices](https://www.techtarget.com/searchsecurity/tip/How-to-overcome-3-multi-tenancy-security-issues)
- [WorkOS Tenant Isolation Guide](https://workos.com/blog/tenant-isolation-in-multi-tenant-systems)
- [Azure Guest Account Risks](https://petri.com/problem-guest-users-outside-tenant/)

---

### CRIT-4: Scheduled Messages Reliability Failures

**Feature:** Scheduled Messages
**Severity:** CRITICAL (Data Loss)

**What goes wrong:** Scheduled messages fail to send due to server restarts, missed cron jobs, or lack of persistence. Users schedule important messages that never arrive.

**Why it happens:** In-memory schedulers (node-cron, setTimeout) lose all scheduled jobs on restart. Single-server cron jobs become single points of failure. No retry logic for failed deliveries.

**Consequences:**
- Scheduled messages silently disappear
- Users lose trust in the feature
- Important communications missed
- Support burden for "lost" messages

**Warning signs:**
- Using in-memory schedulers (node-cron, node-schedule)
- No database persistence for scheduled jobs
- No monitoring for failed scheduled sends
- Jobs don't retry on failure
- nextRunAt timestamp not updated after execution

**Prevention:**
```typescript
// Use database-backed job queue (pg-boss for PostgreSQL)
import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL);
await boss.start();

// Schedule a message
async function scheduleMessage(message: ScheduledMessage) {
  // Persist to database first
  const record = await db.insert(scheduledMessages).values({
    id: generateId(),
    channelId: message.channelId,
    userId: message.userId,
    content: message.content,
    scheduledFor: message.scheduledFor,
    status: 'pending'
  }).returning();

  // Queue the job with pg-boss (survives restarts)
  await boss.send('send-scheduled-message',
    { messageId: record.id },
    {
      startAfter: message.scheduledFor,
      retryLimit: 3,
      retryDelay: 60  // seconds
    }
  );

  return record;
}

// Worker processes jobs
boss.work('send-scheduled-message', async (job) => {
  const { messageId } = job.data;
  const scheduled = await db.query.scheduledMessages.findFirst({
    where: eq(scheduledMessages.id, messageId)
  });

  if (!scheduled || scheduled.status !== 'pending') {
    return;  // Already sent or cancelled
  }

  // Send the message
  await createMessage({
    channelId: scheduled.channelId,
    userId: scheduled.userId,
    content: scheduled.content
  });

  // Mark as sent
  await db.update(scheduledMessages)
    .set({ status: 'sent', sentAt: new Date() })
    .where(eq(scheduledMessages.id, messageId));
});

// Monitor for stuck jobs
setInterval(async () => {
  const stuck = await db.query.scheduledMessages.findMany({
    where: and(
      eq(scheduledMessages.status, 'pending'),
      lt(scheduledMessages.scheduledFor, new Date(Date.now() - 5 * 60 * 1000))
    )
  });
  if (stuck.length > 0) {
    logger.error('Stuck scheduled messages detected', { count: stuck.length });
    // Alert ops team
  }
}, 60000);
```

**Alternative: PostgreSQL-native approach without pg-boss:**
```sql
-- Scheduled messages table with status tracking
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id),
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_pending ON scheduled_messages(scheduled_for)
  WHERE status = 'pending';

-- Poll every minute for due messages
-- SELECT * FROM scheduled_messages
-- WHERE status = 'pending' AND scheduled_for <= NOW()
-- FOR UPDATE SKIP LOCKED
-- LIMIT 100;
```

**Sources:**
- [pg-boss: Node.js PostgreSQL Queue](https://github.com/timgit/pg-boss)
- [PostgreSQL as Job Queue](https://brandur.org/postgres-queues)
- [Cron Job Reliability Issues](https://sre.google/sre-book/distributed-periodic-scheduling/)

---

### CRIT-5: Typing Indicator Broadcast Storms

**Feature:** Typing Indicators
**Severity:** CRITICAL (Performance)

**What goes wrong:** Every keystroke broadcasts a "user is typing" event to all channel members via Socket.IO, overwhelming the server and Redis pub/sub, causing performance degradation for all users.

**Why it happens:** Naive implementation emits on every input event. Large channels (100+ members) multiply each event by member count. No throttling or debouncing.

**Consequences:**
- Redis pub/sub saturation
- Socket.IO server CPU spikes
- Message delivery delays across entire platform
- Users experience lag in all channels
- At 500 concurrent users, system becomes unusable

**Warning signs:**
- Typing indicator fires on every keystroke
- No client-side throttling before emit
- No server-side rate limiting on typing events
- Large channels cause visible lag
- Redis CPU spikes when users type

**Prevention:**
```typescript
// CLIENT SIDE: Throttle typing events
const TYPING_THROTTLE_MS = 3000;
let lastTypingEmit = 0;

function onInputChange(channelId: string) {
  const now = Date.now();
  if (now - lastTypingEmit > TYPING_THROTTLE_MS) {
    socket.emit('typing:start', { channelId });
    lastTypingEmit = now;
  }

  // Auto-stop typing after 5 seconds of no input
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing:stop', { channelId });
  }, 5000);
}

// SERVER SIDE: Rate limit and aggregate
const typingState = new Map<string, Set<string>>();  // channelId -> Set<userId>
const typingTimers = new Map<string, NodeJS.Timeout>();

socket.on('typing:start', async ({ channelId }) => {
  const key = `${channelId}:${socket.userId}`;

  // Rate limit: max 1 event per 2 seconds per user per channel
  const rateLimitKey = `typing:${key}`;
  const allowed = await redis.set(rateLimitKey, '1', 'EX', 2, 'NX');
  if (!allowed) return;

  // Track typing users
  if (!typingState.has(channelId)) {
    typingState.set(channelId, new Set());
  }
  typingState.get(channelId)!.add(socket.userId);

  // Broadcast aggregated typing state (not individual events)
  io.to(`channel:${channelId}`).emit('typing:update', {
    channelId,
    userIds: Array.from(typingState.get(channelId)!)
  });

  // Auto-expire typing status
  clearTimeout(typingTimers.get(key));
  typingTimers.set(key, setTimeout(() => {
    typingState.get(channelId)?.delete(socket.userId);
    io.to(`channel:${channelId}`).emit('typing:update', {
      channelId,
      userIds: Array.from(typingState.get(channelId) || [])
    });
  }, 5000));
});

// For large channels (100+ members): only show "X people typing"
// Don't broadcast to entire channel, use polling or separate endpoint
```

**Sources:**
- [Socket.IO Performance Tuning](https://socket.io/docs/v4/performance-tuning/)
- [Scaling Socket.IO Challenges](https://ably.com/topic/scaling-socketio)
- [Real-time Chat Performance](https://dev.to/sahaj-b/benchmarking-socketio-servers-4n9k)

---

## Important Pitfalls

Mistakes that cause significant bugs, poor UX, or technical debt.

### IMP-1: User Status Message Race Conditions

**Feature:** User Status Messages
**Severity:** IMPORTANT (Data Integrity)

**What goes wrong:** Concurrent status updates from multiple devices create race conditions, causing status to flicker or show incorrect state. Last-write-wins loses user intent.

**Why it happens:** User updates status on phone, then immediately on desktop. Without proper sequencing, the "loser" write may arrive last and overwrite the intended state.

**Warning signs:**
- Status flickers between values
- Users report their status "not sticking"
- Multiple device users see inconsistent status
- No version/timestamp on status updates

**Prevention:**
```typescript
// Use optimistic locking with version numbers
interface UserStatus {
  userId: string;
  emoji: string | null;
  text: string | null;
  expiresAt: Date | null;
  version: number;
  updatedAt: Date;
}

async function updateUserStatus(
  userId: string,
  update: Partial<UserStatus>,
  expectedVersion: number
) {
  const result = await db.update(userStatuses)
    .set({
      ...update,
      version: expectedVersion + 1,
      updatedAt: new Date()
    })
    .where(and(
      eq(userStatuses.userId, userId),
      eq(userStatuses.version, expectedVersion)
    ))
    .returning();

  if (result.length === 0) {
    throw new ConflictError('Status was modified by another device');
  }

  return result[0];
}
```

**Sources:**
- [Real-Time Presence System Design](https://systemdesign.one/real-time-presence-platform-system-design/)

---

### IMP-2: Bookmarks N+1 Query Performance

**Feature:** Bookmarks / Saved Messages
**Severity:** IMPORTANT (Performance)

**What goes wrong:** Loading bookmarked messages causes N+1 queries - one query to get bookmarks, then N queries to load each message with its author, reactions, and thread replies.

**Why it happens:** ORM lazy loading or naive implementation that fetches related data per-item instead of batching.

**Warning signs:**
- Bookmark list loads slowly (>500ms for 20 items)
- Database query count scales with bookmark count
- Visible spinner when opening bookmarks
- Database CPU spikes on bookmark page loads

**Prevention:**
```typescript
// BAD: N+1 queries
const bookmarks = await db.query.bookmarks.findMany({
  where: eq(bookmarks.userId, userId)
});
// Then N queries for each message...

// GOOD: Single query with joins
const bookmarkedMessages = await db.query.bookmarks.findMany({
  where: eq(bookmarks.userId, userId),
  with: {
    message: {
      with: {
        author: true,
        reactions: true,
        _count: { replies: true }
      }
    }
  },
  orderBy: desc(bookmarks.createdAt),
  limit: 50
});

// Also add composite index
// CREATE INDEX idx_bookmarks_user_created
//   ON bookmarks(user_id, created_at DESC);
```

**Sources:**
- [Database Indexing Strategies](https://www.developernation.net/blog/8-indexing-strategies-to-optimize-database-performance/)

---

### IMP-3: Reminder Timezone Chaos

**Feature:** Reminders
**Severity:** IMPORTANT (UX / Data Integrity)

**What goes wrong:** Reminders fire at wrong times for users in different timezones. A 9am reminder set by a user in New York fires at 9am UTC instead of 9am EST.

**Why it happens:** Server stores reminder time without timezone context, or converts to UTC incorrectly. Daylight saving time transitions cause additional chaos.

**Warning signs:**
- Reminders fire at wrong times for non-UTC users
- Off-by-one-hour errors around DST transitions
- No timezone field in reminder records
- Server processes reminders using server timezone

**Prevention:**
```typescript
// ALWAYS store timezone with reminders
interface Reminder {
  id: string;
  userId: string;
  messageId: string;
  // Store both the UTC time AND the user's timezone
  remindAtUtc: Date;          // When to actually fire
  userTimezone: string;        // 'America/New_York'
  userLocalTime: string;       // '09:00' - what user requested
  createdAt: Date;
}

async function createReminder(
  userId: string,
  messageId: string,
  localTime: Date,  // e.g., "2026-01-21 09:00" in user's timezone
  userTimezone: string
) {
  // Convert user's local time to UTC
  const utcTime = zonedTimeToUtc(localTime, userTimezone);

  return db.insert(reminders).values({
    id: generateId(),
    userId,
    messageId,
    remindAtUtc: utcTime,
    userTimezone,
    userLocalTime: format(localTime, 'HH:mm'),
    createdAt: new Date()
  });
}

// When processing reminders, use UTC
async function processReminders() {
  const due = await db.query.reminders.findMany({
    where: and(
      eq(reminders.status, 'pending'),
      lte(reminders.remindAtUtc, new Date())
    )
  });
  // ...
}
```

**Sources:**
- [OneSignal Timezone Scheduling](https://onesignal.com/blog/deliver-by-timezone-push-notification/)
- [Apple Reminders Timezone Issues](https://discussions.apple.com/thread/255105999)

---

### IMP-4: @group Mention Notification Floods

**Feature:** User Groups (@team mentions)
**Severity:** IMPORTANT (Performance / UX)

**What goes wrong:** Mentioning a large group (@engineering with 50 members) creates 50 individual notifications and database writes, causing write amplification and notification fatigue.

**Why it happens:** Naive implementation expands group to individual user notifications at write time. No aggregation or batching.

**Warning signs:**
- Database write spikes on group mentions
- Users complain about notification overload
- Large group mentions cause visible latency
- Notification table grows rapidly
- No mention throttling or cooldowns

**Prevention:**
```typescript
// 1. Rate limit group mentions
const GROUP_MENTION_COOLDOWN_MS = 60000;  // 1 minute
const groupMentionCache = new Map<string, number>();

async function processGroupMention(
  groupId: string,
  channelId: string,
  mentionerUserId: string
) {
  const cacheKey = `${groupId}:${channelId}`;
  const lastMention = groupMentionCache.get(cacheKey) || 0;

  if (Date.now() - lastMention < GROUP_MENTION_COOLDOWN_MS) {
    // Skip duplicate group mention, but still store message
    return { notified: false, reason: 'cooldown' };
  }

  groupMentionCache.set(cacheKey, Date.now());

  // 2. Batch notification inserts
  const members = await getGroupMembers(groupId);
  const notifications = members
    .filter(m => m.id !== mentionerUserId)  // Don't notify self
    .map(member => ({
      id: generateId(),
      userId: member.id,
      type: 'group_mention',
      groupId,
      channelId,
      createdAt: new Date()
    }));

  // Single batch insert
  if (notifications.length > 0) {
    await db.insert(notificationsTable)
      .values(notifications)
      .onConflict(/* handle duplicates */);
  }

  // 3. Single real-time broadcast to group room
  io.to(`group:${groupId}`).emit('notification:group_mention', {
    groupId,
    channelId,
    mentionedBy: mentionerUserId
  });

  return { notified: true, count: notifications.length };
}

// 4. Admin controls: restrict who can use group mentions
// Large groups (50+): only admins can @mention
// Or: require confirmation before mentioning large groups
```

**Sources:**
- [Slack @channel Restrictions](https://slack.com/help/articles/115004855143-Manage-who-can-notify-a-channel-or-workspace)
- [Slack Rate Limits](https://api.slack.com/docs/rate-limits)

---

### IMP-5: Channel Category Deep Nesting Confusion

**Feature:** Channel Categories / Folders
**Severity:** IMPORTANT (UX)

**What goes wrong:** Allowing unlimited nesting depth creates deeply buried channels that users can't find. Tree structures become unmaintainable. Users create duplicate channels because they can't find existing ones.

**Why it happens:** Developers implement "generic" tree structure without limits. No UX research on optimal depth.

**Warning signs:**
- Channels nested 4+ levels deep
- Users create duplicates of existing channels
- "I can't find channel X" support tickets
- Expand/collapse state not persisted
- Mobile UI breaks with deep nesting

**Prevention:**
```typescript
// Limit nesting depth (Slack uses 1 level: sections only)
const MAX_CATEGORY_DEPTH = 1;  // Categories only, no sub-categories

async function createCategory(
  workspaceId: string,
  name: string,
  parentId: string | null
) {
  if (parentId) {
    const parent = await db.query.categories.findFirst({
      where: eq(categories.id, parentId)
    });

    if (parent?.parentId) {
      throw new BadRequestError(
        'Categories cannot be nested more than one level deep'
      );
    }
  }

  // Limit total categories per workspace
  const count = await db.select({ count: sql`count(*)` })
    .from(categories)
    .where(eq(categories.workspaceId, workspaceId));

  if (count[0].count >= 20) {
    throw new BadRequestError('Maximum 20 categories per workspace');
  }

  return db.insert(categories).values({
    id: generateId(),
    workspaceId,
    name,
    parentId,
    position: await getNextPosition(workspaceId, parentId)
  });
}

// Persist user's expand/collapse state
// Store in user_preferences table, not localStorage
```

**Sources:**
- [UX Matters: Beyond Nested Folders](https://www.uxmatters.com/mt/archives/2008/03/wheres-my-stuff-beyond-the-nested-folder-metaphor.php)
- [Category Hierarchy UX](https://www.glendaledesigns.com/product-categories-and-ux-what-you-need-to-consider/)

---

### IMP-6: Link Preview Timeout and Failure Handling

**Feature:** Link Previews / Unfurling
**Severity:** IMPORTANT (UX / Performance)

**What goes wrong:** Slow or unresponsive URLs block message sending, cause UI freezes, or leave empty preview placeholders. Users wait indefinitely for previews to load.

**Why it happens:** Synchronous URL fetching without timeouts. No fallback for failed fetches. No caching for repeated URLs.

**Warning signs:**
- Message send blocked waiting for preview
- Empty preview cards in messages
- Same URL fetched repeatedly (no cache)
- Slow sites cause entire channel to lag

**Prevention:**
```typescript
// 1. Async preview generation (don't block message send)
async function createMessage(message: NewMessage) {
  // Save message immediately
  const saved = await db.insert(messages).values(message).returning();

  // Queue preview generation asynchronously
  if (containsUrls(message.content)) {
    await previewQueue.add('generate-preview', {
      messageId: saved.id,
      urls: extractUrls(message.content)
    });
  }

  return saved;
}

// 2. Strict timeouts
async function fetchPreview(url: string): Promise<LinkPreview | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);  // 5s max

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      follow: 3  // Max 3 redirects
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    return parseOpenGraph(html);
  } catch (e) {
    return null;  // Fail gracefully
  }
}

// 3. Cache previews
const PREVIEW_CACHE_TTL = 24 * 60 * 60;  // 24 hours

async function getOrFetchPreview(url: string): Promise<LinkPreview | null> {
  const cacheKey = `preview:${hashUrl(url)}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Fetch and cache
  const preview = await fetchPreview(url);
  if (preview) {
    await redis.setex(cacheKey, PREVIEW_CACHE_TTL, JSON.stringify(preview));
  }

  return preview;
}

// 4. Client shows graceful fallback
// If preview fails, show clickable URL with favicon only
```

**Sources:**
- [Link Preview API Guide](https://blog.peekalink.io/ultimate-guide-link-preview-apis/)
- [Fixing Social Link Previews](https://prerender.io/blog/how-to-fix-link-previews/)

---

### IMP-7: Channel Archiving Data Consistency

**Feature:** Channel Archiving
**Severity:** IMPORTANT (Data Integrity)

**What goes wrong:** Archived channels have orphaned data (notifications, mentions, search indexes pointing to them). Soft delete flag not checked consistently across queries.

**Why it happens:** Adding `archived_at` column but not updating all queries that touch channels. Foreign key constraints don't account for archived state.

**Warning signs:**
- Search returns messages from archived channels
- Notifications reference archived channels
- Unread counts include archived channels
- "Channel not found" errors after unarchiving

**Prevention:**
```typescript
// 1. Use lifecycle state, not just boolean flag
interface Channel {
  id: string;
  status: 'active' | 'archived' | 'deleted';
  archivedAt: Date | null;
  archivedBy: string | null;
}

// 2. Centralized query helper that ALWAYS filters
function activeChannelsQuery(workspaceId: string) {
  return db.query.channels.findMany({
    where: and(
      eq(channels.workspaceId, workspaceId),
      eq(channels.status, 'active')
    )
  });
}

// 3. Archive process handles all related data
async function archiveChannel(channelId: string, archivedBy: string) {
  await db.transaction(async (tx) => {
    // Update channel status
    await tx.update(channels)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        archivedBy
      })
      .where(eq(channels.id, channelId));

    // Clear unread counts
    await tx.delete(unreadCounts)
      .where(eq(unreadCounts.channelId, channelId));

    // Mark notifications as stale (don't delete, might unarchive)
    await tx.update(notifications)
      .set({ stale: true })
      .where(eq(notifications.channelId, channelId));

    // Remove from search index
    await searchIndex.deleteDocuments({
      filter: `channel_id = ${channelId}`
    });
  });

  // Remove from Socket.IO rooms
  io.in(`channel:${channelId}`).socketsLeave(`channel:${channelId}`);
}

// 4. Unarchive restores everything
async function unarchiveChannel(channelId: string) {
  await db.update(channels)
    .set({ status: 'active', archivedAt: null, archivedBy: null })
    .where(eq(channels.id, channelId));

  // Reindex messages for search
  await reindexChannelMessages(channelId);
}
```

**Sources:**
- [Soft Delete Anti-Pattern](https://www.cultured.systems/2024/04/24/Soft-delete/)
- [PostgreSQL Data Archiving](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/)

---

### IMP-8: Workspace Analytics Privacy Violations

**Feature:** Workspace Analytics
**Severity:** IMPORTANT (Legal / Trust)

**What goes wrong:** Analytics features expose individual user behavior (message counts, active hours, response times) that violates privacy expectations and potentially GDPR. Users feel surveilled.

**Why it happens:** Product team wants "engagement metrics" without considering privacy implications. No anonymization or aggregation.

**Warning signs:**
- Analytics show per-user message counts
- Managers can see individual activity patterns
- No DPIA (Data Protection Impact Assessment)
- No user consent for analytics collection
- Analytics data retained indefinitely

**Prevention:**
```typescript
// 1. Only aggregate analytics, never individual
interface WorkspaceAnalytics {
  // GOOD: Aggregated metrics
  totalMessages: number;
  activeUsersCount: number;  // Not which users
  peakHours: { hour: number; messageCount: number }[];
  channelActivity: { channelId: string; messageCount: number }[];

  // BAD: Individual metrics (don't implement)
  // userMessageCounts: { userId: string; count: number }[];
  // userActiveHours: { userId: string; hours: number[] }[];
}

// 2. Minimum threshold for reporting
function getChannelActivity(workspaceId: string) {
  // Only report channels with 5+ participants
  // Prevents identifying individuals by channel
  return db.query.channels.findMany({
    where: and(
      eq(channels.workspaceId, workspaceId),
      gte(channels.memberCount, 5)
    ),
    select: {
      id: true,
      name: true,
      messageCount: true
    }
  });
}

// 3. Role-based access to analytics
// Only workspace owners, with audit logging
function requireAnalyticsAccess() {
  return async (ctx: Context, next: Next) => {
    const auth = ctx.get('auth');
    if (auth.role !== 'owner') {
      throw new ForbiddenError('Analytics require owner role');
    }

    // Audit log access
    await auditLog.record({
      action: 'analytics_view',
      userId: auth.userId,
      workspaceId: auth.workspaceId,
      timestamp: new Date()
    });

    await next();
  };
}

// 4. Data retention limits
// Analytics data deleted after 90 days
// Or: Only compute on-demand, don't store
```

**GDPR Requirements:**
- Conduct DPIA before implementing
- Document lawful basis (legitimate interest, with balancing test)
- Provide transparency notice to users
- Allow users to opt-out of analytics
- Implement data retention limits

**Sources:**
- [GDPR Employee Monitoring Guide](https://gdprlocal.com/gdpr-employee-monitoring/)
- [Privacy-First Workspace Analytics](https://www.worklytics.co/resources/privacy-first-workspace-analytics-gdpr-ccpa-compliance-guide)
- [Amazon 32M Euro GDPR Fine](https://apploye.com/blog/gdpr-compliance-in-employee-monitoring-software/)

---

## Moderate Pitfalls

Mistakes that cause minor bugs or suboptimal UX.

### MOD-1: Custom Emoji Size and Format Inconsistency

**Feature:** Custom Emoji
**Severity:** MODERATE (UX)

**What goes wrong:** Uploaded emoji display at inconsistent sizes, some blurry (too small source), some dominating text (too large). Animated GIFs cause performance issues.

**Prevention:**
```typescript
// Normalize all emoji to consistent size and format
async function processEmojiUpload(file: Buffer, filename: string) {
  const image = sharp(file);
  const metadata = await image.metadata();

  // Reject if source too small (will be blurry)
  if (metadata.width < 32 || metadata.height < 32) {
    throw new BadRequestError('Emoji must be at least 32x32 pixels');
  }

  // Limit file size (animated GIFs can be huge)
  if (file.length > 256 * 1024) {  // 256KB
    throw new BadRequestError('Emoji must be under 256KB');
  }

  // Resize to standard dimensions
  return image
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()  // Convert to PNG (strips animation from GIFs)
    .toBuffer();
}
```

---

### MOD-2: Bookmark Sync Across Devices

**Feature:** Bookmarks / Saved Messages
**Severity:** MODERATE (UX)

**What goes wrong:** Bookmarks created on mobile don't appear on desktop until page refresh. No real-time sync.

**Prevention:**
```typescript
// Emit bookmark events to user's other sessions
socket.on('bookmark:create', async (messageId) => {
  const bookmark = await createBookmark(socket.userId, messageId);

  // Notify all user's connected devices
  io.to(`user:${socket.userId}`).emit('bookmark:created', bookmark);
});

// Client listens and updates local state
socket.on('bookmark:created', (bookmark) => {
  queryClient.setQueryData(['bookmarks'], (old) => [...old, bookmark]);
});
```

---

### MOD-3: Reminder Delivery When Offline

**Feature:** Reminders
**Severity:** MODERATE (UX)

**What goes wrong:** Reminder fires while user is offline, they never see it. No push notification or email fallback.

**Prevention:**
```typescript
async function fireReminder(reminder: Reminder) {
  const user = await getUser(reminder.userId);
  const sessions = await getUserActiveSessions(reminder.userId);

  if (sessions.length === 0) {
    // User offline - queue push notification
    await pushNotificationQueue.add({
      userId: reminder.userId,
      title: 'Reminder',
      body: `You asked to be reminded about a message`,
      data: { messageId: reminder.messageId }
    });

    // Optionally send email after 5 minutes if still not acknowledged
    await delayedEmailQueue.add(
      { reminderId: reminder.id },
      { delay: 5 * 60 * 1000 }
    );
  } else {
    // User online - send via Socket.IO
    io.to(`user:${reminder.userId}`).emit('reminder:fired', reminder);
  }
}
```

---

### MOD-4: User Group Membership Stale in UI

**Feature:** User Groups
**Severity:** MODERATE (UX)

**What goes wrong:** User added to @engineering group but autocomplete doesn't show them until page refresh. Group membership changes not broadcast.

**Prevention:**
```typescript
// Broadcast group membership changes
async function addUserToGroup(groupId: string, userId: string) {
  await db.insert(groupMembers).values({ groupId, userId });

  // Notify all workspace members (for autocomplete updates)
  io.to(`workspace:${workspaceId}`).emit('group:member_added', {
    groupId,
    userId
  });
}

// Client invalidates group cache on event
socket.on('group:member_added', ({ groupId }) => {
  queryClient.invalidateQueries(['group', groupId, 'members']);
});
```

---

### MOD-5: Channel Archive UI Feedback

**Feature:** Channel Archiving
**Severity:** MODERATE (UX)

**What goes wrong:** User tries to post in archived channel, gets cryptic error. No clear visual indicator channel is archived.

**Prevention:**
```typescript
// Clear visual state in UI
function ChannelHeader({ channel }) {
  return (
    <div className="flex items-center gap-2">
      {channel.status === 'archived' && (
        <Badge variant="warning">Archived</Badge>
      )}
      <h1>{channel.name}</h1>
    </div>
  );
}

// Disable composer with explanation
function MessageComposer({ channel }) {
  if (channel.status === 'archived') {
    return (
      <div className="p-4 bg-gray-100 text-gray-500 text-center">
        This channel is archived. Messages cannot be sent.
        <Button onClick={requestUnarchive}>Request Unarchive</Button>
      </div>
    );
  }
  // ... normal composer
}
```

---

## Minor Pitfalls

Annoyances that are easy to fix.

### MIN-1: Status Emoji Picker Performance

**Feature:** User Status Messages
**Severity:** MINOR

**What goes wrong:** Loading full emoji dataset for status picker causes UI jank. 3000+ emoji rendered at once.

**Prevention:** Use virtualized list (react-window) and lazy load emoji categories.

---

### MIN-2: Link Preview Image Aspect Ratio

**Feature:** Link Previews
**Severity:** MINOR

**What goes wrong:** Preview images stretched or squished due to inconsistent aspect ratios from different sites.

**Prevention:** Use `object-fit: cover` with fixed aspect ratio container (16:9 or 1.91:1 like OpenGraph recommends).

---

### MIN-3: Typing Indicator Flicker

**Feature:** Typing Indicators
**Severity:** MINOR

**What goes wrong:** "User is typing..." appears and disappears rapidly as events arrive.

**Prevention:** Debounce the hide action. Keep showing for 2+ seconds after last typing event.

---

### MIN-4: Guest Account Invitation UX

**Feature:** Guest Accounts
**Severity:** MINOR

**What goes wrong:** Guest invitation email doesn't clearly explain limited access. Guests confused about why they can't see all channels.

**Prevention:** Clear onboarding explaining guest limitations. Show "You have guest access to X channels" in sidebar.

---

## Phase-Specific Implementation Warnings

| Feature | Primary Pitfall | Mitigation |
|---------|-----------------|------------|
| User Status | Race conditions | Optimistic locking with version numbers |
| Bookmarks | N+1 queries | Eager load with joins |
| Scheduled Messages | Reliability | Database-backed queue (pg-boss) |
| Reminders | Timezone handling | Store UTC + user timezone |
| User Groups | Notification floods | Rate limit + batch inserts |
| Channel Categories | Deep nesting | Limit to 1 level |
| Link Previews | SSRF + timeouts | URL validation + async fetch |
| Typing Indicators | Broadcast storms | Client throttle + server rate limit |
| Custom Emoji | SVG XSS | Convert to PNG |
| Channel Archiving | Data consistency | Transaction with cascade updates |
| Guest Accounts | Isolation failures | Centralized auth + RLS |
| Analytics | Privacy violations | Aggregate only + DPIA |

---

## Implementation Priority by Risk

### Implement Security Mitigations First
1. **Link preview SSRF protection** - Block before any URL fetch
2. **Custom emoji SVG sanitization** - Convert to PNG on upload
3. **Guest account authorization** - Centralized checks + tests

### Then Performance Safeguards
4. **Typing indicator throttling** - Before enabling feature
5. **Scheduled message reliability** - Use pg-boss from start
6. **Bookmark query optimization** - Design with joins

### Finally UX Polish
7. **Timezone handling** - Store timezone with reminders
8. **Channel category limits** - Set limits in schema
9. **Analytics aggregation** - Privacy by design

---

## Sources Summary

### Security Sources
- [PortSwigger SSRF Guide](https://portswigger.net/web-security/ssrf)
- [MS Teams SSRF Vulnerability](https://positive.security/blog/ms-teams-1-feature-4-vulns)
- [Securitum SVG XSS Research](https://research.securitum.com/do-you-allow-to-load-svg-files-you-have-xss/)
- [Multi-Tenant Security](https://www.techtarget.com/searchsecurity/tip/How-to-overcome-3-multi-tenancy-security-issues)

### Performance Sources
- [Socket.IO Performance Tuning](https://socket.io/docs/v4/performance-tuning/)
- [Scaling Socket.IO](https://ably.com/topic/scaling-socketio)
- [PostgreSQL Job Queues](https://brandur.org/postgres-queues)
- [Database Indexing Strategies](https://www.developernation.net/blog/8-indexing-strategies-to-optimize-database-performance/)

### Privacy/Compliance Sources
- [GDPR Employee Monitoring Guide](https://gdprlocal.com/gdpr-employee-monitoring/)
- [Privacy-First Analytics](https://www.worklytics.co/resources/privacy-first-workspace-analytics-gdpr-ccpa-compliance-guide)

### UX Sources
- [UX Matters: Nested Folders](https://www.uxmatters.com/mt/archives/2008/03/wheres-my-stuff-beyond-the-nested-folder-metaphor.php)
- [Slack Mention Management](https://slack.com/help/articles/115004855143-Manage-who-can-notify-a-channel-or-workspace)
- [Link Preview API Guide](https://blog.peekalink.io/ultimate-guide-link-preview-apis/)

---

## Confidence Assessment

| Pitfall Category | Confidence | Notes |
|------------------|------------|-------|
| Link Preview SSRF | HIGH | Well-documented vulnerability class, MS Teams case study |
| SVG XSS | HIGH | Multiple CVEs, active exploit technique |
| Guest Isolation | HIGH | Common multi-tenant failure mode |
| Typing Performance | HIGH | Socket.IO documentation confirms limits |
| Scheduled Jobs | HIGH | Google SRE book, pg-boss documentation |
| Timezone Handling | MEDIUM | Common issue, solutions well-known |
| Analytics Privacy | HIGH | GDPR enforcement actions documented |
| Category Nesting | MEDIUM | UX research supports limits |
