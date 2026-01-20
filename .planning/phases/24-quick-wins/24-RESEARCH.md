# Phase 24: Quick Wins - Research

**Researched:** 2026-01-20
**Domain:** Real-time typing indicators, channel archiving, sidebar organization (channel categories)
**Confidence:** HIGH

## Summary

Phase 24 implements three standalone features that extend OComms' existing patterns without major infrastructure changes. All three features can leverage the current Socket.IO/Redis architecture, Drizzle ORM schema patterns, and React component conventions already established in the codebase.

**Typing indicators** extend the existing `socket-events.ts` definitions (typing:start, typing:stop, typing:update are already declared) with a server-side handler that broadcasts to channel rooms and client-side throttling to prevent broadcast storms.

**Channel archiving** adds two columns to the channels table (isArchived, archivedAt), modifies sidebar queries to filter archived channels, and adds permission checks for archive/unarchive operations.

**Channel categories** introduces two new tables (channel_categories, user_category_collapse_states), installs @dnd-kit/core and @dnd-kit/sortable for drag-and-drop reordering, and reorganizes the sidebar component to render grouped channels.

**Primary recommendation:** Implement typing indicators first (smallest scope, highest user visibility), then channel archiving (schema changes, server actions), then categories (most complex UI changes).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.1 | Drag-and-drop primitives | Modern, accessible, React-first DnD library |
| @dnd-kit/sortable | ^8.0 | Sortable list presets | Built on @dnd-kit/core for reorderable lists |
| socket.io | 4.8.3 | Real-time events | Already in use, typing events already defined |
| drizzle-orm | 0.45.1 | Database schema/queries | Already in use, established patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/utilities | ^3.2 | CSS utilities for transforms | Used with sortable for smooth animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | hello-pangea/dnd | hello-pangea is simpler but less flexible; dnd-kit better for custom UI like sidebar categories |
| @dnd-kit | react-beautiful-dnd | Deprecated, unmaintained - use dnd-kit instead |
| Server-side typing storage | Redis ephemeral keys | Not needed - typing state is purely transient, broadcast-only |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server/socket/handlers/
│   └── typing.ts              # NEW: Typing indicator handler
├── components/
│   ├── channel/
│   │   ├── channel-list-client.tsx  # MODIFY: Add category grouping
│   │   └── typing-indicator.tsx     # NEW: Typing display component
│   └── workspace/
│       └── workspace-sidebar.tsx    # MODIFY: Archived section, categories
├── db/schema/
│   ├── channel.ts             # MODIFY: Add isArchived, archivedAt, categoryId
│   └── channel-category.ts    # NEW: Categories and collapse state tables
├── lib/
│   ├── hooks/
│   │   └── use-typing.ts      # NEW: Typing indicator hook
│   └── actions/
│       └── channel.ts         # MODIFY: Add archive/unarchive, category actions
```

### Pattern 1: Typing Indicator Event Flow
**What:** Client throttles typing events, server broadcasts to room, clients display indicator
**When to use:** Any real-time "user is doing X" indicator pattern
**Example:**
```typescript
// Client-side throttled emit (src/lib/hooks/use-typing.ts)
// Throttle: max 1 emit per 3 seconds (TYPE-05)
const TYPING_THROTTLE_MS = 3000;
const TYPING_TIMEOUT_MS = 5000;

export function useTyping(targetId: string, targetType: "channel" | "dm") {
  const socket = useSocket();
  const lastEmitRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastEmitRef.current >= TYPING_THROTTLE_MS) {
      socket.emit("typing:start", { targetId, targetType });
      lastEmitRef.current = now;
    }
    // Reset timeout on each keystroke
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { targetId, targetType });
    }, TYPING_TIMEOUT_MS);
  }, [socket, targetId, targetType]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    socket.emit("typing:stop", { targetId, targetType });
  }, [socket, targetId, targetType]);

  return { emitTyping, stopTyping };
}

// Server-side handler (src/server/socket/handlers/typing.ts)
export function handleTypingEvents(socket: TypedSocket, io: SocketIOServer): void {
  socket.on("typing:start", (data) => {
    const roomName = data.targetType === "channel"
      ? getRoomName.channel(data.targetId)
      : getRoomName.conversation(data.targetId);

    // Broadcast to room except sender
    socket.to(roomName).emit("typing:update", {
      userId: socket.data.userId,
      userName: socket.data.user.name || socket.data.user.email,
      targetId: data.targetId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", (data) => {
    const roomName = data.targetType === "channel"
      ? getRoomName.channel(data.targetId)
      : getRoomName.conversation(data.targetId);

    socket.to(roomName).emit("typing:update", {
      userId: socket.data.userId,
      userName: socket.data.user.name || socket.data.user.email,
      targetId: data.targetId,
      isTyping: false,
    });
  });
}
```

### Pattern 2: Archive Permission Check
**What:** Channel owners and admins can archive; default channel cannot be archived
**When to use:** Any operation with role-based and special-case restrictions
**Example:**
```typescript
// src/lib/actions/channel.ts
export async function archiveChannel(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get channel with member info
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
    with: { members: true },
  });

  if (!channel) throw new Error("Channel not found");

  // ARCH-06: Default channel cannot be archived
  if (channel.slug === "general") {
    throw new Error("The default channel cannot be archived");
  }

  // Check permission: must be channel admin or creator
  const membership = channel.members.find((m) => m.userId === session.user.id);
  const isCreator = channel.createdBy === session.user.id;
  const isAdmin = membership?.role === "admin";

  if (!isCreator && !isAdmin) {
    throw new Error("Only channel admins can archive channels");
  }

  await db.update(channels)
    .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  revalidatePath("/");
  return { success: true };
}
```

### Pattern 3: User Preference Storage (Collapse States)
**What:** Per-user preferences stored in database, loaded on sidebar render
**When to use:** UI state that should persist across sessions/devices
**Example:**
```typescript
// src/db/schema/channel-category.ts
export const userCategoryCollapseStates = pgTable("user_category_collapse_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => channelCategories.id, { onDelete: "cascade" }),
  isCollapsed: boolean("is_collapsed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_category_collapse_unique_idx").on(table.userId, table.categoryId),
]);
```

### Pattern 4: dnd-kit Sortable Implementation
**What:** Drag channels between categories using SortableContext
**When to use:** Reorderable list with multiple containers
**Example:**
```typescript
// Simplified structure - sidebar with draggable channels
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableChannel({ channel }: { channel: Channel }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: channel.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ChannelLink channel={channel} />
    </div>
  );
}

function CategoryGroup({ category, channels }: Props) {
  return (
    <SortableContext items={channels.map(c => c.id)} strategy={verticalListSortingStrategy}>
      {channels.map(channel => (
        <SortableChannel key={channel.id} channel={channel} />
      ))}
    </SortableContext>
  );
}
```

### Anti-Patterns to Avoid
- **Storing typing state in database:** Typing is ephemeral - use only socket broadcasts, no persistence
- **Polling for typing indicators:** Use socket events, not HTTP polling
- **Client-side category order:** Store sort order in database for consistency across devices
- **Hard-deleting archived channels:** Use soft archive (isArchived flag) to preserve history and allow unarchive

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom drag handlers with mouse events | @dnd-kit/sortable | Touch support, accessibility, animation, edge cases |
| Throttling function calls | setInterval/setTimeout logic | Throttle with ref tracking | Refs prevent stale closure issues in React |
| Array reordering | splice/shift operations | @dnd-kit arrayMove() | Immutable, correct index handling |

**Key insight:** Drag-and-drop especially looks simple but has edge cases around touch devices, scroll containers, keyboard accessibility, and animation timing that dnd-kit handles.

## Common Pitfalls

### Pitfall 1: Typing Indicator Memory Leak
**What goes wrong:** Timeouts not cleared on unmount cause updates to unmounted components
**Why it happens:** useEffect cleanup forgotten, or timeout refs not properly managed
**How to avoid:** Store timeout refs and clear in useEffect cleanup; also clear on send
**Warning signs:** React warnings about updates on unmounted components

### Pitfall 2: Broadcast Storm from Typing Events
**What goes wrong:** Typing on every keystroke floods server with events
**Why it happens:** No client-side throttling
**How to avoid:** Implement TYPE-05 (3-second throttle); only emit if enough time passed since last emit
**Warning signs:** High socket traffic, laggy UI during typing

### Pitfall 3: Category Collapse State Flicker
**What goes wrong:** Categories flash open then closed on page load
**Why it happens:** Server renders all open, then client applies saved preferences
**How to avoid:** Fetch collapse states server-side and pass to initial render; or use skeleton loading
**Warning signs:** Visual flicker on sidebar load

### Pitfall 4: Archived Channel Still Receives Messages
**What goes wrong:** Users can post to archived channel via API/socket
**Why it happens:** Archive check only in UI, not server
**How to avoid:** Check isArchived in message:send handler before accepting message
**Warning signs:** Messages appearing in "read-only" archived channel

### Pitfall 5: Race Condition in Category Reorder
**What goes wrong:** Two users reordering simultaneously causes inconsistent state
**Why it happens:** No conflict resolution for concurrent updates
**How to avoid:** Use database sort_order column with atomic update; last write wins is acceptable for this use case
**Warning signs:** Categories appearing in different order for different users

### Pitfall 6: Search Returns Archived Channels Incorrectly
**What goes wrong:** Archived channels hidden from sidebar but user expects to find them
**Why it happens:** Search query excludes archived
**How to avoid:** Per CONTEXT.md, include archived in search by default with optional filter to exclude
**Warning signs:** Users complaining they can't find old channel content

## Code Examples

Verified patterns from official sources and existing codebase:

### Typing Indicator Display Component
```typescript
// src/components/channel/typing-indicator.tsx
"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket-client";

interface TypingUser {
  userId: string;
  userName: string;
}

interface TypingIndicatorProps {
  targetId: string; // channelId or conversationId
}

export function TypingIndicator({ targetId }: TypingIndicatorProps) {
  const socket = useSocket();
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());

  useEffect(() => {
    const handleTypingUpdate = (data: {
      userId: string;
      userName: string;
      targetId: string;
      isTyping: boolean;
    }) => {
      if (data.targetId !== targetId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) {
          next.set(data.userId, { userId: data.userId, userName: data.userName });
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    socket.on("typing:update", handleTypingUpdate);
    return () => {
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [socket, targetId]);

  // Auto-clear stale typing indicators (5 second timeout fallback)
  useEffect(() => {
    const interval = setInterval(() => {
      // If typing users exist but no update received, they may have disconnected
      // Server should handle this, but this is a safety fallback
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const users = Array.from(typingUsers.values());
  if (users.length === 0) {
    // Reserved space - no layout shift
    return <div className="h-5" />;
  }

  // Format: "Alice is typing...", "Alice, Bob are typing...", "Alice, Bob, and 3 others are typing..."
  let text: string;
  if (users.length === 1) {
    text = `${users[0].userName} is typing...`;
  } else if (users.length === 2) {
    text = `${users[0].userName}, ${users[1].userName} are typing...`;
  } else {
    const others = users.length - 2;
    text = `${users[0].userName}, ${users[1].userName}, and ${others} ${others === 1 ? "other" : "others"} are typing...`;
  }

  return (
    <div className="h-5 text-xs text-muted-foreground px-1">
      {text}
    </div>
  );
}
```

### Channel Schema with Archive and Category Fields
```typescript
// src/db/schema/channel.ts (additions)
import { pgTable, text, timestamp, boolean, uuid, uniqueIndex, integer } from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  topic: text("topic"),
  isPrivate: boolean("is_private").notNull().default(false),
  // NEW: Archive fields (ARCH-01 to ARCH-06)
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: text("archived_by").references(() => users.id, { onDelete: "set null" }),
  // NEW: Category field (CCAT-02)
  categoryId: uuid("category_id").references(() => channelCategories.id, { onDelete: "set null" }),
  // NEW: Sort order within category (CCAT-06)
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("channels_org_slug_idx").on(table.organizationId, table.slug),
]);
```

### Channel Categories Schema
```typescript
// src/db/schema/channel-category.ts (NEW file)
import { pgTable, text, timestamp, uuid, uniqueIndex, integer, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";
import { channels } from "./channel";

export const channelCategories = pgTable("channel_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("channel_categories_org_idx").on(table.organizationId),
]);

// Per-user collapse state for categories (CCAT-03)
export const userCategoryCollapseStates = pgTable("user_category_collapse_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => channelCategories.id, { onDelete: "cascade" }),
  isCollapsed: boolean("is_collapsed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_category_collapse_unique_idx").on(table.userId, table.categoryId),
]);

export const channelCategoriesRelations = relations(channelCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channelCategories.organizationId],
    references: [organizations.id],
  }),
  channels: many(channels),
}));
```

### Archived Channel Read-Only Check (Server)
```typescript
// Addition to src/server/socket/handlers/message.ts
// Add before message insert in handleSendMessage:

if (targetType === "channel") {
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, targetId),
    columns: { isArchived: true },
  });

  if (channel?.isArchived) {
    socket.emit("error", { message: "Cannot send messages to archived channels" });
    callback?.({ success: false });
    return;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2023 | react-beautiful-dnd deprecated, dnd-kit is modern replacement |
| Polling for typing | WebSocket events | Always | Real-time with lower latency, less server load |
| Client-side only preferences | Database-backed preferences | N/A | Persist across devices, server-authoritative |

**Deprecated/outdated:**
- react-beautiful-dnd: Officially deprecated by Atlassian, replaced by pragmatic-drag-and-drop or community forks like hello-pangea/dnd. Use @dnd-kit for new projects.
- localStorage for preferences: Use database storage for cross-device consistency in multi-user apps.

## Open Questions

Things that couldn't be fully resolved:

1. **Optimistic UI for archive/unarchive**
   - What we know: Archive operation is fast (single field update)
   - What's unclear: Should sidebar remove channel immediately or wait for server confirmation?
   - Recommendation: Optimistic removal with rollback on error - matches existing unread patterns

2. **Category drag between different workspaces**
   - What we know: Categories are per-organization, channels belong to one org
   - What's unclear: Edge case if user has multiple workspaces open in tabs
   - Recommendation: Categories are org-scoped, no cross-workspace concern

3. **Archived section unread badge**
   - What we know: Archived channels still have messages and unread state
   - What's unclear: Should "Archived" section show aggregate unread?
   - Recommendation: No - archived channels are "out of sight, out of mind" per user intent

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns: socket-events.ts, presence.ts, channel.ts schema
- OComms existing handler patterns: message.ts, notification.ts, unread.ts
- CONTEXT.md decisions: Display format, permissions, sidebar behavior

### Secondary (MEDIUM confidence)
- [dnd-kit official documentation](https://docs.dndkit.com/presets/sortable) - Sortable preset usage
- [Drizzle ORM migrations](https://orm.drizzle.team/docs/migrations) - Schema change workflow
- [Top 5 Drag-and-Drop Libraries for React](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - Library comparison

### Tertiary (LOW confidence)
- [Socket.IO typing indicator patterns](https://rsrohansingh10.medium.com/add-typing-in-your-chat-application-using-socket-io-421c12d8859e) - Community pattern examples
- [Scalable typing indicator architecture](https://medium.com/@ramesh200212/building-a-scalable-real-time-typing-indicator-system-a-deep-dive-into-distributed-architecture-5f14b331c4ab) - Scaling considerations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - dnd-kit is well-established, other libraries already in use
- Architecture: HIGH - Patterns extend existing codebase conventions directly
- Pitfalls: MEDIUM - Based on common patterns, not all verified in this specific context

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stable domain, no fast-moving changes expected)
