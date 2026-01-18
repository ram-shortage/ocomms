# Phase 4: Threading & Reactions - Research

**Researched:** 2026-01-17
**Domain:** Message threading, emoji reactions, pinned messages
**Confidence:** HIGH

## Summary

This phase extends the existing real-time messaging system with three features: threaded conversations, emoji reactions, and pinned messages. The research covers database schema patterns, UI component strategies, and real-time event handling.

**Key findings:**
- Threading uses a self-referencing `parentId` column on messages table (not a separate table)
- Thread participants are tracked via a dedicated `thread_participants` table for notifications
- Emoji reactions use a dedicated `reactions` table with (messageId, userId, emoji) composite uniqueness
- Pinned messages use a simple `pinned_messages` table with timestamp
- The project already uses shadcn/ui, which has Sheet component for thread panel and Popover for emoji picker

**Primary recommendation:** Extend the existing messages schema with `parentId` for threading, add `reactions` and `pinned_messages` tables, and use shadcn/ui Sheet + Frimousse emoji picker for UI.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Database schema/queries | Already in use, supports self-referencing FKs |
| socket.io | 4.8.3 | Real-time events | Already in use for messaging |
| shadcn/ui Sheet | latest | Thread panel | Already using shadcn/ui with new-york style |
| frimousse | latest | Emoji picker | <5KB, unstyled, shadcn integration, lightweight |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-popover | 1.1.x | Emoji picker positioning | Already a shadcn dependency |
| date-fns | 4.1.0 | Thread timestamp formatting | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| frimousse | emoji-picker-react | Larger bundle (~50KB vs <5KB), more features but heavier |
| frimousse | emoji-mart | Full-featured but largest bundle, overkill for reactions |
| shadcn Sheet | Custom drawer | Sheet already handles animation, positioning, accessibility |

**Installation:**
```bash
npm install frimousse
npx shadcn@latest add sheet popover
# OR for pre-styled frimousse:
npx shadcn@latest add https://frimousse.liveblocks.io/r/emoji-picker
```

## Architecture Patterns

### Recommended Database Schema Extensions

```
src/db/schema/
├── message.ts         # Extend: add parentId, replyCount
├── reaction.ts        # NEW: reactions table
├── pinned-message.ts  # NEW: pinned_messages table
└── thread-participant.ts  # NEW: thread subscription tracking
```

### Pattern 1: Self-Referencing Messages for Threads

**What:** Store thread replies in the same messages table with a `parentId` foreign key to the parent message.

**When to use:** Always for threading. Separate tables create join complexity for no benefit.

**Example:**
```typescript
// Source: Drizzle ORM docs - self-referencing foreign keys
import { pgTable, uuid, text, integer, timestamp, AnyPgColumn, index } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id),
  channelId: uuid("channel_id").references(() => channels.id),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  parentId: uuid("parent_id").references((): AnyPgColumn => messages.id), // Self-reference
  replyCount: integer("reply_count").notNull().default(0), // Denormalized for performance
  sequence: integer("sequence").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("messages_parent_idx").on(table.parentId),
]);
```

**Key points:**
- Use `AnyPgColumn` return type annotation for TypeScript
- `replyCount` is denormalized for display without COUNT query
- Replies inherit `channelId`/`conversationId` from parent for room targeting
- Thread depth is limited to 1 level (replies cannot have replies) - matches Slack pattern

### Pattern 2: Reactions Table with Composite Uniqueness

**What:** Dedicated table for message reactions with one row per user+emoji+message combination.

**When to use:** Always for reactions. JSON columns are harder to query and update.

**Example:**
```typescript
// Source: Common messaging app database pattern
export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(), // Unicode emoji: "👍", "❤️", etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reactions_unique_idx").on(table.messageId, table.userId, table.emoji),
  index("reactions_message_idx").on(table.messageId),
]);
```

**Query pattern for grouped reactions:**
```typescript
// Get reactions grouped by emoji with user lists
const reactions = await db
  .select({
    emoji: reactions.emoji,
    count: sql<number>`count(*)`,
    userIds: sql<string[]>`array_agg(${reactions.userId})`,
  })
  .from(reactions)
  .where(eq(reactions.messageId, messageId))
  .groupBy(reactions.emoji);
```

### Pattern 3: Thread Participants for Notifications

**What:** Track which users should receive notifications for thread activity.

**When to use:** Always. Users who start threads, reply, or are mentioned should get notifications.

**Example:**
```typescript
export const threadParticipants = pgTable("thread_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")  // Parent message ID
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("thread_participants_unique_idx").on(table.threadId, table.userId),
  index("thread_participants_user_idx").on(table.userId),
]);
```

**Automatic participant creation:**
- When user starts a thread (creates first reply): add as participant
- When user replies to a thread: add as participant
- When user is @mentioned in thread: add as participant

### Pattern 4: Pinned Messages

**What:** Junction table linking messages to channels with pin metadata.

**When to use:** Always for pinned messages feature.

**Example:**
```typescript
export const pinnedMessages = pgTable("pinned_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  pinnedBy: uuid("pinned_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pinnedAt: timestamp("pinned_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("pinned_messages_unique_idx").on(table.messageId, table.channelId),
  index("pinned_messages_channel_idx").on(table.channelId),
]);
```

### Pattern 5: Socket.IO Room Strategy for Threads

**What:** Thread replies broadcast to both the parent channel/DM room AND a thread-specific room.

**Why:** Users viewing the channel see thread reply count update; users viewing the thread see the full message.

**Example:**
```typescript
// Room naming convention (extends existing pattern)
export const getRoomName = {
  channel: (channelId: string) => `channel:${channelId}`,
  conversation: (conversationId: string) => `dm:${conversationId}`,
  thread: (parentMessageId: string) => `thread:${parentMessageId}`,
  user: (userId: string) => `user:${userId}`,
};

// Broadcasting thread reply
async function broadcastThreadReply(io, message, parentMessage) {
  // 1. Broadcast full message to thread room
  io.to(getRoomName.thread(message.parentId)).emit("thread:reply", message);

  // 2. Broadcast reply count update to channel/DM room
  const roomName = parentMessage.channelId
    ? getRoomName.channel(parentMessage.channelId)
    : getRoomName.conversation(parentMessage.conversationId);

  io.to(roomName).emit("message:replyCount", {
    messageId: message.parentId,
    replyCount: parentMessage.replyCount + 1,
  });

  // 3. Notify thread participants via user rooms
  const participants = await getThreadParticipants(message.parentId);
  for (const participant of participants) {
    if (participant.userId !== message.authorId) {
      io.to(getRoomName.user(participant.userId)).emit("thread:notification", {
        threadId: message.parentId,
        messageId: message.id,
        preview: message.content.slice(0, 100),
      });
    }
  }
}
```

### Anti-Patterns to Avoid

- **Nested thread tables:** Don't create a separate `threads` table and `thread_messages` table. Self-referencing is simpler.
- **JSON column for reactions:** Don't store reactions as `{emoji: [userIds]}` JSON. Makes add/remove operations complex.
- **Unlimited thread depth:** Don't allow replies to replies. Slack restricts to one level for good reason - simplicity.
- **Polling for thread updates:** Don't poll for new replies. Use Socket.IO rooms for real-time.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Emoji picker UI | Custom emoji grid/search | frimousse | Unicode edge cases, skin tone support, search, a11y |
| Slide-in panel | Custom CSS transitions | shadcn/ui Sheet | Animation, focus trap, click-outside, keyboard handling |
| Popover positioning | Manual absolute positioning | Radix Popover | Collision detection, viewport boundaries, scroll handling |
| Emoji rendering | String emoji display | Native system emoji | Cross-platform consistency already handled by OS |

**Key insight:** Emoji handling has surprising complexity (skin tone modifiers, ZWJ sequences, platform differences). Use a picker library that handles this.

## Common Pitfalls

### Pitfall 1: Thread Reply Count Desync

**What goes wrong:** `replyCount` on parent message gets out of sync with actual reply count.

**Why it happens:** Race conditions when multiple users reply simultaneously; deleted replies not decrementing count.

**How to avoid:**
- Use database transactions for reply creation that increment count
- Use `sql<raw>` for atomic increment: `replyCount: sql\`${messages.replyCount} + 1\``
- On reply soft-delete, decrement parent's replyCount
- Consider periodic reconciliation job for safety

**Warning signs:** Reply count shows different number than visible replies in thread.

### Pitfall 2: Missing Thread Participant

**What goes wrong:** User doesn't receive thread notifications even though they participated.

**Why it happens:** Participant record not created on certain paths (edit that adds @mention, etc.).

**How to avoid:**
- Create participant record in same transaction as reply creation
- Check for mentions in message content and add participants
- Always create participant for thread starter (parent message author)

**Warning signs:** Users report missing thread notifications intermittently.

### Pitfall 3: Emoji Uniqueness Collision

**What goes wrong:** User can add same emoji twice to same message.

**Why it happens:** Race condition between checking existence and inserting.

**How to avoid:**
- Use `ON CONFLICT DO NOTHING` for reaction insert
- Let database constraint (unique index) enforce uniqueness
- Handle constraint violation gracefully in API

**Warning signs:** Duplicate emoji badges showing for same user.

### Pitfall 4: Thread Panel State Management

**What goes wrong:** Opening thread for message A while thread B is already open shows stale data.

**Why it happens:** Component state not properly reset when thread changes.

**How to avoid:**
- Key the thread panel component with `key={threadId}`
- Clear messages state when threadId changes
- Leave old thread room, join new thread room on change

**Warning signs:** Thread panel shows wrong messages briefly before updating.

### Pitfall 5: Pinned Message Deletion

**What goes wrong:** Pinned message gets deleted but pin entry remains, causing errors.

**Why it happens:** Foreign key cascade not set up, or soft delete doesn't cascade.

**How to avoid:**
- Use `onDelete: "cascade"` on pinned_messages.messageId FK
- When soft-deleting message, also remove from pinned_messages
- Filter out deleted messages when fetching pinned messages

**Warning signs:** "Pinned Messages" view shows errors or empty cards.

## Code Examples

### Thread Reply Handler (Socket.IO)

```typescript
// Source: Extends existing message handler pattern
async function handleThreadReply(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { parentId: string; content: string },
  callback?: (response: { success: boolean; messageId?: string }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { parentId, content } = data;

  try {
    // Get parent message to inherit channel/conversation
    const [parent] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, parentId), isNull(messages.deletedAt)))
      .limit(1);

    if (!parent) {
      socket.emit("error", { message: "Parent message not found" });
      callback?.({ success: false });
      return;
    }

    // Prevent nested threads
    if (parent.parentId !== null) {
      socket.emit("error", { message: "Cannot reply to a reply" });
      callback?.({ success: false });
      return;
    }

    // Transaction: create reply + increment parent count + add participant
    const [newMessage] = await db.transaction(async (tx) => {
      // Get next sequence number
      const condition = parent.channelId
        ? eq(messages.channelId, parent.channelId)
        : eq(messages.conversationId, parent.conversationId!);

      const [maxSeq] = await tx
        .select({ maxSequence: max(messages.sequence) })
        .from(messages)
        .where(condition);

      const sequence = (maxSeq?.maxSequence ?? 0) + 1;

      // Insert reply
      const [reply] = await tx
        .insert(messages)
        .values({
          content,
          authorId: userId,
          channelId: parent.channelId,
          conversationId: parent.conversationId,
          parentId: parentId,
          sequence,
        })
        .returning();

      // Increment parent reply count
      await tx
        .update(messages)
        .set({ replyCount: sql`${messages.replyCount} + 1` })
        .where(eq(messages.id, parentId));

      // Add/update thread participant
      await tx
        .insert(threadParticipants)
        .values({ threadId: parentId, userId })
        .onConflictDoUpdate({
          target: [threadParticipants.threadId, threadParticipants.userId],
          set: { lastReadAt: new Date() },
        });

      return [reply];
    });

    // Broadcast (implementation per Pattern 5)
    await broadcastThreadReply(io, newMessage, parent);

    callback?.({ success: true, messageId: newMessage.id });
  } catch (error) {
    console.error("[Thread] Error creating reply:", error);
    socket.emit("error", { message: "Failed to send reply" });
    callback?.({ success: false });
  }
}
```

### Reaction Toggle Handler

```typescript
// Source: Common toggle pattern for reactions
async function handleReactionToggle(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { messageId: string; emoji: string }
): Promise<void> {
  const userId = socket.data.userId;
  const { messageId, emoji } = data;

  try {
    // Check if reaction exists
    const [existing] = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji)
        )
      )
      .limit(1);

    let action: "added" | "removed";

    if (existing) {
      // Remove reaction
      await db
        .delete(reactions)
        .where(eq(reactions.id, existing.id));
      action = "removed";
    } else {
      // Add reaction (ON CONFLICT DO NOTHING for race condition safety)
      await db
        .insert(reactions)
        .values({ messageId, userId, emoji })
        .onConflictDoNothing();
      action = "added";
    }

    // Get message to determine room
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) return;

    // Broadcast to room
    const roomName = message.channelId
      ? getRoomName.channel(message.channelId)
      : getRoomName.conversation(message.conversationId!);

    io.to(roomName).emit("reaction:update", {
      messageId,
      emoji,
      userId,
      userName: socket.data.user.name,
      action,
    });

    // Also broadcast to thread room if message is in a thread
    if (message.parentId) {
      io.to(getRoomName.thread(message.parentId)).emit("reaction:update", {
        messageId,
        emoji,
        userId,
        userName: socket.data.user.name,
        action,
      });
    }
  } catch (error) {
    console.error("[Reaction] Error toggling reaction:", error);
    socket.emit("error", { message: "Failed to update reaction" });
  }
}
```

### Frimousse Emoji Picker with Popover

```tsx
// Source: Frimousse documentation + shadcn integration
"use client";

import { EmojiPicker } from "frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SmilePlus } from "lucide-react";

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

export function ReactionPicker({ onSelectEmoji }: ReactionPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <SmilePlus className="h-4 w-4" />
          <span className="sr-only">Add reaction</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[352px] p-0" align="start">
        <EmojiPicker.Root
          onEmojiSelect={(emoji) => onSelectEmoji(emoji.emoji)}
          className="flex h-[300px] flex-col"
        >
          <EmojiPicker.Search
            className="mx-2 mt-2 rounded-md border px-3 py-2 text-sm"
            placeholder="Search emoji..."
          />
          <EmojiPicker.Viewport className="flex-1 overflow-y-auto p-2">
            <EmojiPicker.Loading className="flex h-full items-center justify-center">
              Loading...
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="flex h-full items-center justify-center text-muted-foreground">
              No emoji found
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="grid grid-cols-8 gap-1"
              components={{
                Emoji: ({ emoji, ...props }) => (
                  <button
                    {...props}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-accent"
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
}
```

### Thread Panel with Sheet

```tsx
// Source: shadcn/ui Sheet pattern
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MessageList } from "@/components/message/message-list";
import { MessageInput } from "@/components/message/message-input";
import type { Message } from "@/lib/socket-events";

interface ThreadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  parentMessage: Message | null;
  replies: Message[];
  onSendReply: (content: string) => void;
}

export function ThreadPanel({
  isOpen,
  onClose,
  parentMessage,
  replies,
  onSendReply,
}: ThreadPanelProps) {
  if (!parentMessage) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Thread</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4">
          {/* Parent message */}
          <div className="pb-4 border-b">
            <MessageItem message={parentMessage} isParent />
          </div>

          {/* Replies */}
          <div className="flex-1 overflow-y-auto py-4">
            {replies.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">
                No replies yet
              </p>
            ) : (
              replies.map((reply) => (
                <MessageItem key={reply.id} message={reply} />
              ))
            )}
          </div>

          {/* Reply input */}
          <div className="pt-4 border-t">
            <MessageInput
              onSend={onSendReply}
              placeholder="Reply in thread..."
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nested threads | Single-level threads | 2017 (Slack) | Simpler UX, easier implementation |
| Reaction JSON columns | Dedicated reactions table | N/A | Better query performance, atomic updates |
| Custom emoji sprites | Native Unicode emoji | 2020+ | Smaller bundles, auto-updates with OS |
| Polling for updates | WebSocket rooms | 2015+ | Real-time experience, lower server load |

**Deprecated/outdated:**
- **emoji-picker-react v3:** Use v4+ for React 18+ support
- **Custom thread depth:** Slack proved single-level is superior UX

## Open Questions

Things that couldn't be fully resolved:

1. **Thread notification badge count**
   - What we know: Need to track unread replies per thread per user
   - What's unclear: Best place to store count (Redis? DB column? Computed?)
   - Recommendation: Use `lastReadAt` in thread_participants, compute unread count on demand

2. **"All Threads" pagination strategy**
   - What we know: Need to show threads user participates in, sorted by recent activity
   - What's unclear: Most efficient query for this across many threads
   - Recommendation: Start simple (join thread_participants + messages), add caching if needed

3. **Reaction animations**
   - What we know: Slack/Discord have animations when reactions added
   - What's unclear: Whether to implement, complexity level
   - Recommendation: Skip for MVP, add as enhancement later

## Sources

### Primary (HIGH confidence)
- Drizzle ORM documentation - Self-referencing foreign keys with AnyPgColumn
- shadcn/ui documentation - Sheet and Popover components
- Frimousse documentation - Emoji picker API and shadcn integration
- Socket.IO documentation - Rooms pattern for broadcasting

### Secondary (MEDIUM confidence)
- [Slack System Design articles](https://systemdesign.one/slack-architecture/) - Threading and reactions patterns
- [Slack Engineering](https://slack.engineering/weaving-threads/) - Thread design decisions (UX focus)
- [Database design tutorials](https://www.back4app.com/tutorials/how-to-design-a-database-schema-for-a-real-time-chat-and-messaging-app) - Chat schema patterns

### Tertiary (LOW confidence)
- WebSearch results for "thread subscription table" - General patterns, need validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project patterns and well-documented libraries
- Architecture: HIGH - Self-referencing tables and reactions tables are established patterns
- Pitfalls: MEDIUM - Based on common messaging app issues, may miss project-specific concerns

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (30 days - stable domain)
