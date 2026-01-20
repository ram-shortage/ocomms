# Technology Stack for v0.5.0 Features

**Project:** OComms v0.5.0 Feature Completeness
**Researched:** 2026-01-20
**Confidence:** HIGH (leverages existing stack patterns)

## Executive Summary

Most v0.5.0 features require **no new dependencies** - they extend existing infrastructure (Socket.IO, Redis, PostgreSQL/Drizzle, file uploads). Three features benefit from targeted library additions:

1. **Link previews**: `unfurl` library for metadata extraction
2. **Scheduled messages/Reminders**: `bullmq` for Redis-based job scheduling
3. **Image processing**: `sharp` for emoji/avatar resizing (optional but recommended)

The existing stack is well-suited for these features. Key principle: **leverage what exists before adding new dependencies**.

---

## Feature-by-Feature Stack Recommendations

### 1. User Status Messages

**New dependencies:** None

**Implementation approach:**
- Extend `profiles` table with `statusEmoji` and `statusText` columns
- Use existing `frimousse` emoji picker for status emoji selection
- Broadcast status updates via existing Socket.IO presence infrastructure
- Store status expiration as optional timestamp for auto-clear

**Schema addition:**
```typescript
// Add to profiles table
statusEmoji: varchar("status_emoji", { length: 32 }), // emoji character
statusText: varchar("status_text", { length: 100 }),
statusExpiresAt: timestamp("status_expires_at"),
```

**Why no new libraries:**
- `frimousse` already handles emoji picker UI
- Socket.IO already broadcasts presence updates
- Simple text/emoji storage, no special processing needed

---

### 2. Bookmarks / Saved Messages

**New dependencies:** None

**Implementation approach:**
- New `bookmarks` table linking users to messages
- API routes for add/remove/list bookmarks
- Client-side UI with message reference display

**Schema:**
```typescript
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  note: text("note"), // optional user note
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("bookmarks_user_message_idx").on(table.userId, table.messageId),
  index("bookmarks_user_idx").on(table.userId),
]);
```

**Why no new libraries:** Pure CRUD operations on existing database.

---

### 3. Scheduled Messages

**New dependencies:** `bullmq` (HIGH confidence recommendation)

| Package | Version | Purpose |
|---------|---------|---------|
| bullmq | ^5.66.5 | Redis-based job queue with delayed job support |

**Why BullMQ:**
- Already using Redis (`ioredis` in package.json) - no new infrastructure
- Supports delayed jobs (schedule message for future delivery)
- Persists jobs across server restarts
- TypeScript-native (matches existing codebase)
- Actively maintained (Bull is in maintenance mode, BullMQ is successor)

**Why NOT alternatives:**
- `node-cron`: No persistence - jobs lost on restart
- `agenda`: Requires MongoDB - we use PostgreSQL
- `node-schedule`: No persistence, in-memory only

**Implementation approach:**
```typescript
// Scheduled message flow:
// 1. User composes message with future send time
// 2. Store in `scheduled_messages` table with status "pending"
// 3. Add delayed job to BullMQ queue
// 4. Worker processes job at scheduled time
// 5. Move to regular messages table, emit via Socket.IO
```

**Schema:**
```typescript
export const scheduledMessages = pgTable("scheduled_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  authorId: text("author_id").notNull().references(() => users.id),
  channelId: uuid("channel_id").references(() => channels.id),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, cancelled
  jobId: text("job_id"), // BullMQ job reference
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Installation:**
```bash
npm install bullmq
```

---

### 4. Reminders

**New dependencies:** Uses same `bullmq` as scheduled messages

**Implementation approach:**
- Reminders are delayed notification jobs
- User sets reminder on any message
- BullMQ schedules notification delivery
- At reminder time: create notification + push notification

**Schema:**
```typescript
export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  channelId: uuid("channel_id").references(() => channels.id),
  note: text("note"), // custom reminder text
  remindAt: timestamp("remind_at").notNull(),
  status: text("status").notNull().default("pending"), // pending, delivered, cancelled
  jobId: text("job_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Why shared with scheduled messages:** Same queue infrastructure, different job types.

---

### 5. User Groups (@team mentions)

**New dependencies:** None

**Implementation approach:**
- New `user_groups` and `user_group_members` tables
- Extend mention parsing (already in `src/lib/mentions.ts`) to handle group syntax
- Group expansion at notification time (mention @team -> notify all members)

**Schema:**
```typescript
export const userGroups = pgTable("user_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(), // e.g., "engineering"
  handle: text("handle").notNull(), // e.g., "engineering" for @engineering
  description: text("description"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_groups_org_handle_idx").on(table.organizationId, table.handle),
]);

export const userGroupMembers = pgTable("user_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => userGroups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_group_members_unique_idx").on(table.groupId, table.userId),
]);
```

**Why no new libraries:** Mention parsing is text manipulation - extend existing regex patterns.

---

### 6. Channel Categories / Folders

**New dependencies:** None

**Implementation approach:**
- New `channel_categories` table
- Add `categoryId` foreign key to `channels` table
- Drag-and-drop reordering with `position` column

**Schema:**
```typescript
export const channelCategories = pgTable("channel_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  isCollapsed: boolean("is_collapsed").notNull().default(false), // per-user state stored client-side
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Add to channels table:
categoryId: uuid("category_id").references(() => channelCategories.id, { onDelete: "set null" }),
position: integer("position").notNull().default(0),
```

**Why no new libraries:** Pure database relations + frontend drag-drop (can use native HTML5 or existing Radix primitives).

---

### 7. Link Previews / Unfurling

**New dependencies:** `unfurl` (HIGH confidence recommendation)

| Package | Version | Purpose |
|---------|---------|---------|
| unfurl | ^6.4.0 | Metadata extraction (Open Graph, Twitter Cards, oEmbed) |

**Why `unfurl`:**
- Supports Open Graph, Twitter Cards, and oEmbed protocols
- Lightweight, well-maintained
- Handles edge cases (redirects, missing tags, fallbacks)
- No headless browser required (unlike puppeteer-based solutions)

**Why NOT alternatives:**
- `link-preview-js`: Less complete metadata extraction, primarily client-focused
- `puppeteer`-based: Heavy dependency, resource-intensive, overkill for metadata
- Custom implementation: Reinventing the wheel for complex edge cases

**Implementation approach:**
```typescript
// Server-side unfurling (API route or background job)
import { unfurl } from "unfurl";

const metadata = await unfurl(url);
// Returns: { title, description, favicon, open_graph, twitter_card, oEmbed }
```

**Security considerations:**
- Rate limit unfurl requests per user
- Cache unfurled metadata in database
- Timeout requests (prevent slow external sites blocking workers)
- Consider SSRF protections (blocklist internal IPs)

**Schema for caching:**
```typescript
export const linkPreviews = pgTable("link_previews", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull().unique(),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  siteName: text("site_name"),
  faviconUrl: text("favicon_url"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // re-fetch after expiry
});
```

**Installation:**
```bash
npm install unfurl
```

---

### 8. Typing Indicators

**New dependencies:** None

**Implementation approach:**
- Ephemeral state only (no database storage)
- Socket.IO events: `typing:start`, `typing:stop`
- Redis pub/sub for multi-server broadcasting (already configured)
- Client-side debouncing to reduce event volume

**Socket events:**
```typescript
// Client -> Server
socket.emit("typing:start", { channelId });
socket.emit("typing:stop", { channelId });

// Server -> Clients (broadcast to channel room)
socket.to(channelRoom).emit("typing:update", {
  channelId,
  userId,
  userName,
  isTyping: true
});
```

**Why no new libraries:**
- Socket.IO already handles real-time events
- Redis already handles pub/sub for multi-server
- No persistence needed - typing state is ephemeral

**Best practices:**
- Auto-stop after 5 seconds of inactivity
- Debounce keystrokes (emit max once per 2 seconds)
- Clear indicator on message send
- Show "X is typing" for 1 user, "X and Y are typing" for 2, "Several people are typing" for 3+

---

### 9. Custom Emoji

**New dependencies:** `sharp` (MEDIUM confidence recommendation - optional but beneficial)

| Package | Version | Purpose |
|---------|---------|---------|
| sharp | ^0.34.5 | High-performance image processing for emoji resizing |

**Why `sharp`:**
- 4-5x faster than ImageMagick for image processing
- Converts to WebP for smaller file sizes
- Resizes to consistent dimensions (32x32 or 64x64 for emoji)
- Already handles formats existing upload code supports (PNG, JPEG, GIF, WebP)

**Why optional:**
- Could store original images without processing
- But consistent sizing improves UX and reduces storage/bandwidth

**Why NOT alternatives:**
- `jimp`: Pure JS, significantly slower for production
- `imagemagick`: External binary dependency, harder to deploy
- No processing: Works but inconsistent emoji sizes in UI

**Implementation approach:**
```typescript
// Resize uploaded emoji to 64x64 WebP
import sharp from "sharp";

const processedEmoji = await sharp(uploadedBuffer)
  .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 90 })
  .toBuffer();
```

**Schema:**
```typescript
export const customEmoji = pgTable("custom_emoji", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(), // :parrot: -> "parrot"
  path: text("path").notNull(), // /uploads/emoji/{id}.webp
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("custom_emoji_org_name_idx").on(table.organizationId, table.name),
]);
```

**Frimousse integration:**
- Note: As of research date, frimousse does not have built-in custom emoji support
- Open PR #25 adds custom emoji support but not yet merged
- **Options:**
  1. Fork frimousse and add custom emoji rendering
  2. Render custom emoji separately alongside frimousse picker
  3. Watch for PR merge and update when available

**Installation:**
```bash
npm install sharp
```

---

### 10. Channel Archiving

**New dependencies:** None

**Implementation approach:**
- Soft delete pattern with `archivedAt` timestamp on channels
- Archived channels: read-only, hidden from sidebar by default
- Filter queries to exclude archived by default
- Admin can unarchive (restore)

**Schema change:**
```typescript
// Add to channels table
archivedAt: timestamp("archived_at"),
archivedBy: text("archived_by").references(() => users.id),
```

**Query pattern:**
```typescript
// Default: exclude archived
const activeChannels = await db.query.channels.findMany({
  where: isNull(channels.archivedAt)
});

// Include archived (admin view)
const allChannels = await db.query.channels.findMany();
```

**Why no new libraries:** Standard soft-delete pattern with Drizzle ORM.

---

### 11. Guest Accounts

**New dependencies:** None (uses existing `better-auth`)

**Implementation approach:**
- Better-auth supports anonymous/guest accounts via `anonymous()` plugin
- Add `isGuest` boolean to user schema
- Create role-based permission checks for guest limitations:
  - Can view invited channels only
  - Cannot create channels or invite others
  - Limited message history access
  - Cannot access admin features

**Schema addition:**
```typescript
// Extend user model (better-auth manages this)
isGuest: boolean("is_guest").default(false),
guestExpiresAt: timestamp("guest_expires_at"), // auto-expire guest accounts
guestInvitedBy: text("guest_invited_by").references(() => users.id),
```

**Permission matrix:**
| Action | Member | Guest |
|--------|--------|-------|
| Send messages | Yes | Yes (invited channels only) |
| Create channels | Yes | No |
| Invite users | Yes | No |
| Access admin | Role-based | No |
| Search all messages | Yes | No |
| View channel history | Full | Limited (e.g., 30 days) |

**Why no new libraries:** Better-auth already supports this pattern.

---

### 12. Workspace Analytics

**New dependencies:** None (custom implementation recommended)

**Why NOT external analytics tools:**
- **Metabase/Grafana**: Overkill for workspace-specific metrics
- **PostHog/Plausible**: Designed for web analytics, not workspace activity
- **Data sovereignty**: External tools conflict with self-hosted values

**Implementation approach:**
- Aggregate queries on existing tables (messages, channels, users)
- Pre-compute daily stats via scheduled job (use BullMQ from scheduled messages)
- Store aggregates in dedicated analytics table for fast dashboard queries

**Schema:**
```typescript
export const workspaceAnalytics = pgTable("workspace_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  date: timestamp("date").notNull(),

  // Message metrics
  messagesCount: integer("messages_count").notNull().default(0),
  threadsCount: integer("threads_count").notNull().default(0),
  reactionsCount: integer("reactions_count").notNull().default(0),

  // User metrics
  activeUsers: integer("active_users").notNull().default(0),
  newUsers: integer("new_users").notNull().default(0),

  // Channel metrics
  activeChannels: integer("active_channels").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("workspace_analytics_org_date_idx").on(table.organizationId, table.date),
]);
```

**Dashboard metrics to expose:**
- Daily/weekly/monthly message volume
- Most active channels
- Most active users (opt-in, privacy-conscious)
- Peak activity hours
- Thread engagement rate
- Reaction usage

**Why custom is better for OComms:**
- Minimal footprint (no new services)
- Full control over privacy
- Queries existing data (no event tracking infrastructure)
- Matches self-hosted philosophy

---

## Summary: New Dependencies

| Package | Version | Required For | Type |
|---------|---------|--------------|------|
| `bullmq` | ^5.66.5 | Scheduled messages, Reminders | Required |
| `unfurl` | ^6.4.0 | Link previews | Required |
| `sharp` | ^0.34.5 | Custom emoji processing | Recommended |

**Installation command:**
```bash
npm install bullmq unfurl sharp
```

---

## Dependencies NOT to Add

| Package | Why Avoid |
|---------|-----------|
| `agenda` | Requires MongoDB (we use PostgreSQL) |
| `node-cron` | No persistence - jobs lost on restart |
| `puppeteer` | Heavy, unnecessary for metadata extraction |
| `jimp` | Too slow for production image processing |
| `metabase` | Overkill for workspace metrics |
| `posthog` | External service conflicts with data sovereignty |

---

## Existing Stack Leverage Summary

| Existing Tech | Features It Enables |
|---------------|---------------------|
| Socket.IO + Redis | Typing indicators, status broadcasts, real-time updates |
| PostgreSQL + Drizzle | All schema additions, soft deletes, analytics aggregates |
| `frimousse` | Status emoji picker, reaction emoji (custom emoji TBD) |
| `better-auth` | Guest accounts via anonymous plugin |
| File upload system | Custom emoji uploads (extend existing pattern) |
| `web-push` | Reminder notifications |

**Principle:** 10 of 12 features need 0-1 new dependencies. The stack is well-architected for extension.

---

## Sources

### Link Previews
- [unfurl GitHub](https://github.com/jacktuck/unfurl) - Metadata scraper supporting Open Graph, Twitter Cards, oEmbed
- [link-preview-js npm](https://www.npmjs.com/package/link-preview-js) - Alternative considered

### Job Scheduling
- [BullMQ Documentation](https://docs.bullmq.io) - Redis-based job queue
- [Better Stack Node.js Schedulers Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/)
- [BullMQ Scheduled Tasks Guide](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)

### Image Processing
- [sharp Documentation](https://sharp.pixelplumbing.com/) - High-performance Node.js image processing
- [sharp npm](https://www.npmjs.com/package/sharp)

### Emoji/Custom Emoji
- [frimousse GitHub](https://github.com/liveblocks/frimousse) - Lightweight React emoji picker
- [Custom emoji PR #25](https://github.com/liveblocks/frimousse/pulls) - Pending custom emoji support

### Guest Accounts
- [Better Auth Anonymous Plugin](https://dev.to/daanish2003/anonymous-login-using-betterauth-nextjs-prisma-shadcn-5334)
- [Better Auth Organization Plugin](https://www.better-auth.com/docs/plugins/organization) - Role-based access

### Soft Delete / Archiving
- [Drizzle ORM Soft Delete Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/4031)
- [Soft Deletes with Drizzle ORM Guide](https://wanago.io/2024/07/22/api-nestjs-soft-deletes-drizzle/)

### Typing Indicators
- [Socket.IO Real-Time Guide 2025](https://www.videosdk.live/developer-hub/socketio/What-is-socket-io)
- [Socket.IO Client Best Practices](https://www.videosdk.live/developer-hub/socketio/socketio-client)

### Workspace Analytics
- [PostHog Open Source Analytics](https://posthog.com/blog/best-open-source-analytics-tools) - Survey of options
- [Metabase](https://www.metabase.com/) - Considered but rejected for scope
