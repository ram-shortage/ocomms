# Architecture Patterns for v0.5.0 Features

**Project:** OComms v0.5.0 Feature Integration
**Researched:** 2026-01-20
**Confidence:** HIGH (based on existing codebase patterns)

## Existing Architecture Summary

OComms follows a consistent architecture pattern across all features:

```
Frontend (React)              Backend (Next.js/Socket.IO)           Database (PostgreSQL)
------------------            ---------------------------           ---------------------
Components (*.tsx)    <---->  Socket Handlers (handlers/*.ts)  <--> Schema (schema/*.ts)
                      <---->  API Routes (api/**/route.ts)     <-->
Hooks (use*.ts)       <---->  Socket Events (socket-events.ts) <-->
```

**Key Architectural Patterns Identified:**

1. **Socket.IO for Real-Time** - All real-time features use Socket.IO with Redis adapter
2. **API Routes for CRUD** - REST endpoints for non-real-time operations (pins, settings)
3. **Drizzle ORM** - PostgreSQL with typed schema in `src/db/schema/`
4. **Room-Based Broadcasting** - Socket rooms: `channel:`, `conversation:`, `workspace:`, `user:`
5. **Redis for Ephemeral State** - Presence, unread caching, typing indicators

---

## Feature Analysis and Integration Patterns

### 1. User Status Messages (Custom Status with Emoji)

**Category:** Extends existing presence system

**Component Boundaries:**
```
Frontend                    Socket Handler                Database
--------                    --------------                --------
PresenceIndicator.tsx  -->  presence.ts (extend)    -->   profiles (extend) OR
StatusPicker.tsx (new) -->                          -->   user_statuses (new table)
```

**Schema Design:**
```typescript
// Option A: Extend profiles table (RECOMMENDED - simpler)
profiles: {
  ...existing,
  statusText: varchar("status_text", { length: 100 }),
  statusEmoji: varchar("status_emoji", { length: 8 }), // Unicode emoji
  statusExpiresAt: timestamp("status_expires_at"), // For auto-clear
}

// Option B: Separate table (if need history/scheduling)
userStatuses: {
  id: uuid,
  userId: text -> users.id,
  text: varchar(100),
  emoji: varchar(8),
  expiresAt: timestamp,
  createdAt: timestamp,
}
```

**Data Flow:**
1. User sets status via StatusPicker component
2. API route updates profiles/user_statuses table
3. Socket broadcasts `presence:statusUpdate` to workspace room
4. PresenceIndicator components update to show emoji + status text

**Socket Events to Add:**
```typescript
// ServerToClientEvents
"presence:statusUpdate": (data: {
  userId: string;
  statusText: string | null;
  statusEmoji: string | null;
}) => void;

// ClientToServerEvents
"presence:setStatus": (data: {
  statusText: string | null;
  statusEmoji: string | null;
  expiresAt?: Date;
}) => void;
```

**Build Dependencies:** None - can build independently

---

### 2. Bookmarks / Saved Messages

**Category:** New user-scoped collection feature

**Component Boundaries:**
```
Frontend                     API Route                    Database
--------                     ---------                    --------
MessageItem.tsx (extend)     /api/bookmarks/route.ts -->  bookmarks (new)
BookmarksList.tsx (new)      /api/bookmarks/[id]/    -->
BookmarksPanel.tsx (new)
```

**Schema Design:**
```typescript
bookmarks: {
  id: uuid().primaryKey(),
  userId: text -> users.id,
  messageId: uuid -> messages.id,
  note: text, // Optional user note about why bookmarked
  createdAt: timestamp,
}
// Index: (userId, messageId) unique
// Index: userId for listing
```

**Data Flow:**
1. User clicks bookmark icon on MessageItem
2. API POST /api/bookmarks creates record
3. User views bookmarks via sidebar link or panel
4. API GET /api/bookmarks returns paginated list with message content

**Why API Not Socket:** Bookmarks are not real-time collaborative - personal collection.

**Build Dependencies:** Requires messages table (exists)

---

### 3. Scheduled Messages

**Category:** New async message feature (requires background job)

**Component Boundaries:**
```
Frontend                      API/Socket                   Database
--------                      ----------                   --------
MessageInput.tsx (extend)     /api/scheduled/route.ts -->  scheduled_messages (new)
SchedulePicker.tsx (new)      scheduledMessageJob.ts  -->
ScheduledList.tsx (new)       message.ts (extend)     -->
```

**Schema Design:**
```typescript
scheduledMessages: {
  id: uuid().primaryKey(),
  authorId: text -> users.id,
  channelId: uuid -> channels.id (nullable),
  conversationId: uuid -> conversations.id (nullable),
  content: text,
  attachmentIds: text[], // Array of attachment IDs to link when sent
  scheduledFor: timestamp,
  status: text, // "pending" | "sent" | "cancelled" | "failed"
  sentMessageId: uuid -> messages.id (nullable), // Links to actual message when sent
  createdAt: timestamp,
  updatedAt: timestamp,
}
// Index: (authorId, status) for listing pending
// Index: (scheduledFor, status) for job processing
```

**Data Flow:**
1. User composes message with schedule time
2. API POST /api/scheduled saves to scheduled_messages
3. Background job (cron or queue) polls for due messages
4. Job calls internal message:send logic, updates status
5. Broadcast happens via normal message:new flow

**Background Job Options:**
- **Simple:** Node cron job running every minute
- **Better:** Redis-based delayed queue (BullMQ)
- **Simplest for MVP:** API route that runs on Vercel cron

**Build Dependencies:** Requires messages system (exists), file attachments (exists)

---

### 4. Reminders

**Category:** New notification feature with scheduling

**Component Boundaries:**
```
Frontend                      API/Socket                   Database
--------                      ----------                   --------
MessageItem.tsx (extend)      /api/reminders/route.ts -->  reminders (new)
ReminderPicker.tsx (new)      reminderJob.ts          -->
RemindersList.tsx (new)       notification.ts (extend)-->
```

**Schema Design:**
```typescript
reminders: {
  id: uuid().primaryKey(),
  userId: text -> users.id,
  messageId: uuid -> messages.id (nullable), // Reminder about a message
  channelId: uuid -> channels.id (nullable), // Reminder about a channel
  conversationId: uuid -> conversations.id (nullable),
  note: text, // Custom note
  remindAt: timestamp,
  status: text, // "pending" | "sent" | "dismissed"
  createdAt: timestamp,
}
// Index: (userId, status) for listing
// Index: (remindAt, status) for job processing
```

**Data Flow:**
1. User sets reminder on message/channel via ReminderPicker
2. API POST /api/reminders creates record
3. Background job polls for due reminders
4. Job creates notification + sends push notification
5. User receives notification:new event

**Socket Events:** Reuses existing notification:new system

**Build Dependencies:**
- Requires notifications system (exists)
- Shares background job infrastructure with scheduled messages

---

### 5. User Groups (@team mentions)

**Category:** New mention expansion feature

**Component Boundaries:**
```
Frontend                        API/Socket                    Database
--------                        ----------                    --------
MentionAutocomplete.tsx (ext)   /api/user-groups/route.ts --> user_groups (new)
UserGroupManager.tsx (new)      notification.ts (extend)  --> user_group_members (new)
WorkspaceSettings.tsx (extend)
```

**Schema Design:**
```typescript
userGroups: {
  id: uuid().primaryKey(),
  organizationId: text -> organizations.id,
  name: text, // e.g., "engineering", "design"
  handle: text, // e.g., "engineering" for @engineering
  description: text,
  createdBy: text -> users.id,
  createdAt: timestamp,
  updatedAt: timestamp,
}
// Index: (organizationId, handle) unique

userGroupMembers: {
  id: uuid().primaryKey(),
  groupId: uuid -> user_groups.id,
  userId: text -> users.id,
  addedBy: text -> users.id,
  addedAt: timestamp,
}
// Index: (groupId, userId) unique
```

**Data Flow:**
1. Admin creates groups via UserGroupManager
2. MentionAutocomplete queries groups when user types @
3. When message sent with @groupname, notification.ts:
   - Looks up group members
   - Expands to individual notifications (like @channel)
4. Each member receives notification:new

**Integration with Existing:**
- Extend `parseMentions()` in `src/lib/mentions.ts` to recognize group mentions
- Extend notification.ts `createNotifications()` to expand groups

**Build Dependencies:** Requires notifications system (exists)

---

### 6. Channel Categories / Folders

**Category:** UI organization feature (sidebar)

**Component Boundaries:**
```
Frontend                         API Route                      Database
--------                         ---------                      --------
WorkspaceSidebar.tsx (extend)    /api/channel-categories/  --> channel_categories (new)
ChannelListClient.tsx (extend)                             --> channels (extend)
CategoryManager.tsx (new)
```

**Schema Design:**
```typescript
channelCategories: {
  id: uuid().primaryKey(),
  organizationId: text -> organizations.id,
  name: text,
  position: integer, // For ordering
  isCollapsed: boolean, // Default collapsed state
  createdAt: timestamp,
}
// Index: (organizationId, position)

// Extend channels:
channels: {
  ...existing,
  categoryId: uuid -> channel_categories.id (nullable),
  positionInCategory: integer, // For ordering within category
}
```

**Data Flow:**
1. Admin creates/manages categories via settings
2. Channels assigned to categories (or "Uncategorized")
3. Sidebar groups channels by category
4. User can collapse/expand categories (stored in localStorage or user preferences)

**Why Not Socket:** Category changes are rare, page refresh acceptable.

**Build Dependencies:** None - pure UI organization

---

### 7. Link Previews / Unfurling

**Category:** Message enhancement (async enrichment)

**Component Boundaries:**
```
Frontend                      API/Socket/Job                Database
--------                      --------------                --------
MessageContent.tsx (extend)   /api/unfurl/route.ts      --> link_previews (new)
LinkPreview.tsx (new)         unfurlJob.ts              -->
                              message.ts (extend emit)  -->
```

**Schema Design:**
```typescript
linkPreviews: {
  id: uuid().primaryKey(),
  url: text, // Canonical URL
  title: text,
  description: text,
  imageUrl: text,
  siteName: text,
  fetchedAt: timestamp,
  expiresAt: timestamp, // Cache expiry
}
// Index: url unique
// TTL: Re-fetch after 24-48 hours

// Option: Store per-message link associations
messageLinkPreviews: {
  id: uuid().primaryKey(),
  messageId: uuid -> messages.id,
  linkPreviewId: uuid -> link_previews.id,
  position: integer, // Order of links in message
}
```

**Data Flow:**
1. Message sent, message:new emitted as normal
2. Server extracts URLs from message content
3. For each URL:
   - Check cache (link_previews)
   - If miss, queue async fetch
4. After fetch completes:
   - Store in link_previews
   - Emit `message:preview` event with preview data
5. Client updates message with preview cards

**Socket Events to Add:**
```typescript
"message:preview": (data: {
  messageId: string;
  previews: Array<{
    url: string;
    title: string;
    description: string;
    imageUrl: string | null;
    siteName: string;
  }>;
}) => void;
```

**Security Considerations:**
- Fetch via server-side only (prevent SSRF)
- URL allowlist/blocklist
- Timeout on fetch operations
- Sanitize HTML in previews

**Build Dependencies:** Requires messages system (exists)

---

### 8. Typing Indicators

**Category:** Ephemeral real-time state (Redis only, no DB)

**Component Boundaries:**
```
Frontend                      Socket Handler             Storage
--------                      --------------             -------
MessageInput.tsx (extend)     NEW: typing.ts        --> Redis (ephemeral)
TypingIndicator.tsx (new)
```

**Redis Key Design:**
```
typing:{channelId|conversationId}:users -> SET of userIds
typing:{channelId|conversationId}:{userId} -> TTL key (3-5 seconds)
```

**Data Flow:**
1. User starts typing, client emits `typing:start`
2. Server:
   - Adds userId to typing set for target
   - Sets TTL key for auto-cleanup
   - Broadcasts `typing:update` to room
3. Client stops typing (pause/send), emits `typing:stop`
4. Server removes from set, broadcasts update
5. TTL expires if client disconnects

**Socket Events (already partially defined):**
```typescript
// ClientToServerEvents
"typing:start": (data: { targetId: string; targetType: "channel" | "dm" }) => void;
"typing:stop": (data: { targetId: string; targetType: "channel" | "dm" }) => void;

// ServerToClientEvents
"typing:update": (data: {
  userId: string;
  userName: string;
  targetId: string;
  isTyping: boolean;
}) => void;
```

**Note:** Events already defined in socket-events.ts, just need handler implementation.

**Build Dependencies:** Requires Redis (optional - graceful degradation)

---

### 9. Custom Emoji

**Category:** Workspace-scoped asset management

**Component Boundaries:**
```
Frontend                       API Route                    Database
--------                       ---------                    --------
ReactionPicker.tsx (extend)    /api/custom-emoji/      --> custom_emoji (new)
EmojiManager.tsx (new)         /api/upload/emoji/      -->
MentionAutocomplete.tsx (ext)
```

**Schema Design:**
```typescript
customEmoji: {
  id: uuid().primaryKey(),
  organizationId: text -> organizations.id,
  name: text, // e.g., "partyparrot" for :partyparrot:
  imageUrl: text, // Path to uploaded image
  uploadedBy: text -> users.id,
  createdAt: timestamp,
}
// Index: (organizationId, name) unique
```

**Data Flow:**
1. Admin uploads emoji via EmojiManager
2. API validates, resizes, stores image
3. Custom emoji appear in ReactionPicker alongside Unicode
4. When user reacts with custom emoji:
   - Store emoji name (":partyparrot:") in reactions table
   - Existing reaction system handles it
5. ReactionDisplay renders custom emoji images

**Integration with Existing:**
- Reactions table stores emoji as text - can store `:custom_name:`
- ReactionDisplay checks if emoji starts with `:` and ends with `:`
- If yes, lookup custom emoji and render image

**Build Dependencies:** Requires reactions system (exists), file upload (exists)

---

### 10. Channel Archiving

**Category:** Channel lifecycle management

**Component Boundaries:**
```
Frontend                       API Route                    Database
--------                       ---------                    --------
ChannelSettings.tsx (extend)   /api/channels/[id]/     --> channels (extend)
ChannelList.tsx (extend)       archive/route.ts        -->
ArchivedChannels.tsx (new)
```

**Schema Design:**
```typescript
// Extend channels:
channels: {
  ...existing,
  archivedAt: timestamp, // NULL = active, set = archived
  archivedBy: text -> users.id,
}
```

**Data Flow:**
1. Admin clicks "Archive Channel" in settings
2. API sets archivedAt timestamp
3. Channel removed from sidebar (filtered out)
4. Messages remain searchable
5. Archived channels viewable in separate list
6. Admin can unarchive (set archivedAt to NULL)

**Access Rules:**
- Archived channels: read-only, no new messages
- Search includes archived channel messages
- Archived channels don't count toward channel limits

**Build Dependencies:** None - simple flag extension

---

### 11. Guest Accounts

**Category:** Authorization/permission system extension

**Component Boundaries:**
```
Frontend                       API/Auth                     Database
--------                       --------                     --------
InviteMemberForm.tsx (extend)  better-auth config (ext) --> members (extend)
MemberList.tsx (extend)        authz.ts (extend)        -->
GuestBanner.tsx (new)          Channel access checks    -->
```

**Schema Design:**
```typescript
// Extend members table (or invitations):
members: {
  ...existing,
  role: text, // "member" | "admin" | "guest"
}

// New table for guest channel access:
guestChannelAccess: {
  id: uuid().primaryKey(),
  memberId: text -> members.id,
  channelId: uuid -> channels.id,
  grantedBy: text -> users.id,
  grantedAt: timestamp,
}
// Index: (memberId, channelId) unique
```

**Guest Restrictions:**
- Can only see explicitly granted channels
- Cannot create channels
- Cannot invite others
- Cannot access workspace settings
- Cannot use DMs (or limited DM to specific users)
- May have message rate limits

**Data Flow:**
1. Admin invites user as "guest"
2. Admin grants access to specific channels
3. Guest joins workspace, sees only granted channels
4. All authz checks verify guest permissions
5. Guest banner shown to remind of limited access

**Integration Points:**
- `isChannelMember()` in authz.ts - check guestChannelAccess
- Sidebar channel list - filter by guest access
- Channel creation - deny for guests
- Settings pages - hide/deny for guests

**Build Dependencies:** Requires auth system (exists), complex - recommend later phase

---

### 12. Workspace Analytics

**Category:** Read-only reporting feature

**Component Boundaries:**
```
Frontend                       API Route                    Database
--------                       ---------                    --------
AnalyticsDashboard.tsx (new)   /api/admin/analytics/   --> messages (read)
AnalyticsCharts.tsx (new)                               --> members (read)
                                                        --> channels (read)
                                                        --> (aggregate queries)
```

**Schema Design:** No new tables - uses aggregate queries on existing data.

**Metrics to Compute:**
```typescript
interface WorkspaceAnalytics {
  // Activity metrics
  messagesLast7Days: number;
  messagesLast30Days: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;

  // Growth metrics
  newMembersLast30Days: number;
  newChannelsLast30Days: number;

  // Engagement metrics
  messagesPerUserAvg: number;
  topChannelsByMessages: Array<{ channelName: string; count: number }>;
  topUsersByMessages: Array<{ userName: string; count: number }>;

  // Usage patterns
  messagesByDayOfWeek: number[];
  messagesByHourOfDay: number[];
  peakHour: number;
}
```

**Data Flow:**
1. Admin navigates to workspace analytics page
2. API runs aggregate queries on messages, members, channels
3. Results cached briefly (5 minutes)
4. Dashboard renders charts

**Performance Considerations:**
- Use materialized views or pre-computed daily summaries for large workspaces
- Cache results in Redis
- Limit time range queries

**Build Dependencies:** None - read-only on existing data

---

## Suggested Build Order

Based on dependencies and complexity:

### Phase 1: Low Complexity, No Dependencies
1. **Typing Indicators** - Events already defined, just needs handler
2. **Channel Archiving** - Simple flag on existing table
3. **Channel Categories** - UI-only organization

### Phase 2: Medium Complexity, Existing Patterns
4. **User Status Messages** - Extends presence, follows existing pattern
5. **Bookmarks** - Simple new table, follows pins pattern
6. **Custom Emoji** - Extends reactions, follows file upload pattern

### Phase 3: Requires Background Jobs
7. **Scheduled Messages** - Needs background job infrastructure
8. **Reminders** - Shares job infrastructure with scheduled messages
9. **Link Previews** - Async enrichment pattern

### Phase 4: Complex Authorization
10. **User Groups** - Extends mentions/notifications
11. **Guest Accounts** - Authorization overhaul
12. **Workspace Analytics** - Admin-only, needs careful scoping

---

## Component Boundary Summary

| Feature | Socket Handler | API Route | New Table(s) | Extends |
|---------|---------------|-----------|--------------|---------|
| Status Messages | Yes (presence.ts) | Maybe | profiles OR user_statuses | presence |
| Bookmarks | No | Yes | bookmarks | messages |
| Scheduled Messages | Indirect | Yes | scheduled_messages | messages |
| Reminders | Indirect | Yes | reminders | notifications |
| User Groups | Yes (notification.ts) | Yes | user_groups, user_group_members | mentions |
| Channel Categories | No | Yes | channel_categories | channels |
| Link Previews | Yes (new event) | Yes | link_previews | messages |
| Typing Indicators | Yes (new handler) | No | None (Redis) | - |
| Custom Emoji | No | Yes | custom_emoji | reactions |
| Channel Archiving | No | Yes | None (extend channels) | channels |
| Guest Accounts | Indirect | Yes | guestChannelAccess | auth, authz |
| Analytics | No | Yes | None (aggregates) | - |

---

## Real-Time vs REST Decision Matrix

| Feature | Primary Access Pattern | Recommendation |
|---------|----------------------|----------------|
| Status Messages | Broadcast to workspace | Socket + API |
| Bookmarks | Personal collection | API only |
| Scheduled Messages | Create/list/cancel | API only |
| Reminders | Create/list/dismiss | API + notification socket |
| User Groups | Admin management + mention | API + extend notification socket |
| Channel Categories | Admin management | API only |
| Link Previews | Async enrichment | Socket for updates |
| Typing Indicators | High-frequency ephemeral | Socket only |
| Custom Emoji | Asset management | API only |
| Channel Archiving | Rare state change | API only |
| Guest Accounts | Access control | API only |
| Analytics | Read-only dashboard | API only |

---

## Shared Infrastructure Needs

### Background Job System
Features requiring scheduled processing:
- Scheduled Messages
- Reminders
- Link Preview fetching
- Status expiration

**Recommendation:** BullMQ with Redis (already have Redis for presence)

### File Storage
Features requiring file uploads:
- Custom Emoji

**Existing:** File attachment system in `/api/upload/attachment/` - can be reused.

### Admin Permission Checks
Features requiring admin-only access:
- User Groups management
- Channel Categories management
- Custom Emoji management
- Workspace Analytics
- Guest account management

**Pattern:** Check `members.role === "admin"` in organization context.

---

## Scalability Considerations

### At 500 Concurrent Users (Target)

The proposed features add minimal overhead:
- Status messages: One broadcast per status change (rare)
- Typing indicators: Ephemeral, Redis only, ~2-3 events/second per active user
- Link previews: Async, background job
- Analytics: Admin-only, cached

### Potential Bottlenecks

| Feature | Bottleneck Risk | Mitigation |
|---------|-----------------|------------|
| Typing Indicators | High event volume | Throttle client-side (2-3s), Redis TTL |
| Link Previews | External fetch latency | Async queue, timeout, caching |
| Analytics | Complex queries | Cache results, materialized views |
| User Groups | Large group mention | Rate limit, async notification creation |

---

## Anti-Patterns to Avoid

### Anti-Pattern: Persisting Ephemeral State
**Example:** Writing typing indicators to PostgreSQL
**Why bad:** High write volume for 3-second TTL data
**Instead:** Use Redis with TTL

### Anti-Pattern: Synchronous Link Fetching
**Example:** Blocking message send while fetching previews
**Why bad:** Latency, external dependency in critical path
**Instead:** Emit message immediately, async preview fetch

### Anti-Pattern: Over-Broadcasting
**Example:** Broadcasting every status change to all connected users
**Why bad:** Scales poorly, wastes bandwidth
**Instead:** Broadcast to workspace room only, lazy-load status on profile view

### Anti-Pattern: N+1 Queries for Analytics
**Example:** Querying each channel separately for message counts
**Why bad:** O(n) queries, slow
**Instead:** Single aggregate query with GROUP BY

---

## Sources

- Codebase analysis: `src/db/schema/*.ts`
- Codebase analysis: `src/server/socket/handlers/*.ts`
- Codebase analysis: `src/app/api/**/route.ts`
- Codebase analysis: `src/lib/socket-events.ts`
- Codebase analysis: `src/components/**/*.tsx`
- Existing ARCHITECTURE.md patterns
