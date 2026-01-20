# Phase 26: Collections & Presence - Research

**Researched:** 2026-01-20
**Domain:** Bookmarks/saved items, user status messages with DND
**Confidence:** HIGH

## Summary

This phase implements two related features: (1) bookmarks/saved items that let users save messages and files for quick access, and (2) custom user status messages with emoji, expiration, presets, and Do Not Disturb (DND) mode. Both features follow established patterns in the codebase.

Bookmarks are a straightforward personal collection feature requiring a single database table with polymorphic references to either messages or file attachments. The UI follows the existing sidebar pattern (Threads, Scheduled, Reminders) with a "Saved Items" section. Navigation to the original context uses existing channel/DM routing.

User status extends the existing presence system (active/away/offline) by adding a custom status text, emoji, and optional DND mode. Status is stored in a database table with BullMQ integration for auto-expiration (leveraging Phase 25 infrastructure). DND mode pauses notifications globally, implemented by checking user status before sending push/in-app notifications.

**Primary recommendation:** Add a `bookmarks` table for saved items and a `user_statuses` table for custom status. Use existing patterns for sidebar links, list views, and BullMQ for status expiration. DND check should be centralized in the push notification send function.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Database schema and queries | Already in use throughout codebase |
| bullmq | ^5.66.5 | Status expiration scheduling | Already installed and configured in Phase 25 |
| date-fns | ^4.1.0 | Duration formatting and time calculations | Already in use |
| lucide-react | existing | Icons (Bookmark, UserCircle, Moon) | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-popover | existing | Emoji picker for status | Already installed via shadcn/ui |
| emoji-mart | N/A | NOT RECOMMENDED | Overkill for simple status emoji; use native emoji input |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native emoji input | emoji-mart library | emoji-mart adds ~200KB; native input sufficient for status |
| Separate bookmark table | Add saved column to messages | Polymorphic table cleaner, supports files |
| Redis status storage | PostgreSQL table | DB needed for DND persistence and complex queries; Redis TTL doesn't support DB-backed DND state |

**Installation:**
```bash
# No new packages needed - leverages existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/schema/
│   ├── bookmark.ts          # New: bookmarks table
│   └── user-status.ts       # New: user_statuses table
├── lib/actions/
│   ├── bookmark.ts          # Server actions for bookmark CRUD
│   └── user-status.ts       # Server actions for status CRUD
├── workers/
│   ├── status-expiration.worker.ts  # Process status clear jobs
│   └── index.ts             # Add status worker
├── components/
│   ├── bookmark/
│   │   ├── bookmark-button.tsx       # Save/unsave toggle in message actions
│   │   ├── bookmark-list.tsx         # Saved items list view
│   │   └── bookmark-item.tsx         # Single saved item display
│   └── status/
│       ├── status-editor.tsx         # Status input with emoji, text, expiration
│       ├── status-presets.tsx        # Preset status options
│       ├── status-display.tsx        # Status badge shown next to name
│       └── status-indicator.tsx      # Combines presence + status
├── server/queue/
│   └── status-expiration.queue.ts    # Queue for status expiration jobs
└── app/(workspace)/[workspaceSlug]/
    └── saved/page.tsx                # Saved items page
```

### Pattern 1: Polymorphic Bookmarks Table
**What:** Single table with nullable columns for different target types (message or file)
**When to use:** When bookmarking different entity types with shared metadata
**Example:**
```typescript
// src/db/schema/bookmark.ts
import { pgTable, text, timestamp, uuid, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { messages } from "./message";
import { fileAttachments } from "./file-attachment";

export const bookmarkTypeEnum = pgEnum("bookmark_type", ["message", "file"]);

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: bookmarkTypeEnum("type").notNull(),
  messageId: uuid("message_id")
    .references(() => messages.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .references(() => fileAttachments.id, { onDelete: "cascade" }),
  note: text("note"), // Optional user note
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // User can only bookmark same item once
  uniqueIndex("bookmarks_user_message_unique_idx").on(table.userId, table.messageId),
  uniqueIndex("bookmarks_user_file_unique_idx").on(table.userId, table.fileId),
  // Efficient lookup by user
  index("bookmarks_user_idx").on(table.userId),
  index("bookmarks_created_idx").on(table.userId, table.createdAt),
]);

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [bookmarks.messageId],
    references: [messages.id],
  }),
  file: one(fileAttachments, {
    fields: [bookmarks.fileId],
    references: [fileAttachments.id],
  }),
}));
```

### Pattern 2: User Status with Expiration
**What:** Store status in database, use BullMQ for auto-expiration
**When to use:** Status with DND mode that affects notification delivery
**Example:**
```typescript
// src/db/schema/user-status.ts
import { pgTable, text, timestamp, uuid, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

export const userStatuses = pgTable("user_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(), // One status per user
  emoji: text("emoji"), // Single emoji character
  text: text("text"), // Up to 100 characters
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Auto-clear time
  dndEnabled: boolean("dnd_enabled").notNull().default(false), // Pause notifications
  jobId: text("job_id"), // BullMQ job ID for expiration
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_statuses_user_unique_idx").on(table.userId),
  index("user_statuses_expires_idx").on(table.expiresAt),
]);

export const userStatusesRelations = relations(userStatuses, ({ one }) => ({
  user: one(users, {
    fields: [userStatuses.userId],
    references: [users.id],
  }),
}));
```

### Pattern 3: Status Expiration with BullMQ
**What:** Schedule job to clear status at expiration time
**When to use:** For STAT-03 auto-clear functionality
**Example:**
```typescript
// Creating a status with expiration
async function setUserStatus(data: SetStatusInput) {
  const existingStatus = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, data.userId),
  });

  // Cancel existing expiration job if any
  if (existingStatus?.jobId) {
    const job = await statusExpirationQueue.getJob(existingStatus.jobId);
    if (job) await job.remove();
  }

  // Upsert status
  const [status] = await db.insert(userStatuses)
    .values({
      userId: data.userId,
      emoji: data.emoji,
      text: data.text,
      expiresAt: data.expiresAt,
      dndEnabled: data.dndEnabled ?? false,
    })
    .onConflictDoUpdate({
      target: userStatuses.userId,
      set: {
        emoji: data.emoji,
        text: data.text,
        expiresAt: data.expiresAt,
        dndEnabled: data.dndEnabled ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Schedule expiration job if expiresAt is set
  if (data.expiresAt) {
    const delay = data.expiresAt.getTime() - Date.now();
    const job = await statusExpirationQueue.add(
      "clear-status",
      { userId: data.userId },
      { delay, jobId: `status-${data.userId}` }
    );

    await db.update(userStatuses)
      .set({ jobId: job.id })
      .where(eq(userStatuses.id, status.id));
  }

  return status;
}
```

### Pattern 4: DND Check in Notification Pipeline
**What:** Check DND status before sending notifications
**When to use:** Centralize DND check for all notification types
**Example:**
```typescript
// Update src/lib/push/send.ts
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number; dndBlocked?: boolean }> {
  // Check DND status first
  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
  });

  if (status?.dndEnabled) {
    console.log(`[Push] User ${userId} has DND enabled, skipping notification`);
    return { sent: 0, failed: 0, removed: 0, dndBlocked: true };
  }

  // ... existing push logic
}
```

### Pattern 5: Status Display Integration
**What:** Extend existing presence display with custom status
**When to use:** Showing status next to usernames throughout app
**Example:**
```typescript
// src/components/status/status-indicator.tsx
interface StatusIndicatorProps {
  userId: string;
  showText?: boolean; // Show full status text or just emoji
}

export function StatusIndicator({ userId, showText = false }: StatusIndicatorProps) {
  const { getPresence } = usePresence();
  const { data: status } = useQuery({
    queryKey: ["userStatus", userId],
    queryFn: () => getUserStatus(userId),
  });

  const presence = getPresence(userId);

  return (
    <div className="flex items-center gap-1">
      <PresenceIndicator status={presence} size="sm" />
      {status?.emoji && (
        <span className="text-sm" title={status.text || undefined}>
          {status.emoji}
        </span>
      )}
      {showText && status?.text && (
        <span className="text-xs text-muted-foreground truncate max-w-32">
          {status.text}
        </span>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Storing status only in Redis:** Need DB for DND persistence and complex queries (who has DND?)
- **Separate tables for message and file bookmarks:** Polymorphic table cleaner, reduces code duplication
- **Full emoji picker library:** Overkill for status; native input or simple preset emoji sufficient
- **Checking DND in every notification sender:** Centralize in push utility function
- **Real-time status updates via Socket.IO for every user:** Status changes are rare; fetch on demand or cache with reasonable TTL

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Emoji input | Custom emoji picker | Native input + preset emoji buttons | Status uses single emoji; full picker overkill |
| Jump to message | Custom navigation | Existing channel/DM routing | Messages have channelId/conversationId for navigation |
| Status expiration | setTimeout/cron | BullMQ delayed jobs | Already have infrastructure; survives restarts |
| DND notification blocking | Check in each sender | Centralize in sendPushToUser | Single point of control, consistent behavior |
| Status broadcast | Socket.IO to all users | Fetch on demand | Status changes infrequently; real-time not needed |

**Key insight:** Bookmarks and status are primarily database features with simple UI. The complexity is in the DND integration which must touch the notification pipeline.

## Common Pitfalls

### Pitfall 1: Bookmark Cascade Deletion Issues
**What goes wrong:** Bookmarked message deleted but bookmark entry remains with null reference
**Why it happens:** CASCADE on messageId doesn't handle orphaned bookmark gracefully
**How to avoid:**
- Use `onDelete: "cascade"` on foreign key (already handles this)
- When displaying bookmarks, filter out any with null messageId/fileId
- UI shows "Item no longer available" for orphaned bookmarks
**Warning signs:** Bookmarks list shows empty items or errors

### Pitfall 2: DND Not Blocking All Notifications
**What goes wrong:** User has DND enabled but still gets some notifications
**Why it happens:** DND check only added to push, not in-app notifications
**How to avoid:**
- Create a single `shouldDeliverNotification(userId)` function
- Call it in: sendPushToUser, Socket.IO notification:new emission, reminder:fired emission
- Don't forget in-app toasts and badge updates
**Warning signs:** Push blocked but browser toast still shows

### Pitfall 3: Status Expiration Race Condition
**What goes wrong:** User updates status; old expiration job clears the new status
**Why it happens:** Old job fires after new status is set
**How to avoid:**
- Always cancel existing job before creating new status
- Use user-specific job ID (`status-${userId}`) for easy lookup
- Worker processor checks if status matches expected clear time
**Warning signs:** Status disappears unexpectedly after update

### Pitfall 4: Bookmark Count Performance
**What goes wrong:** Sidebar badge count causes N+1 queries
**Why it happens:** Counting bookmarks on every render
**How to avoid:**
- Fetch count with initial page load
- Only refresh on bookmark add/remove (optimistic update)
- Don't real-time sync count; it's not critical
**Warning signs:** Slow sidebar rendering, excessive DB queries

### Pitfall 5: Status Not Visible in All Contexts
**What goes wrong:** Status shows in member list but not in message headers
**Why it happens:** Forgot to add StatusIndicator to all user display points
**How to avoid:**
- Audit all places where username/avatar is shown
- Create a UserDisplay component that includes status
- Use it consistently: message headers, member lists, DM headers
**Warning signs:** Status visible in some views but not others

### Pitfall 6: Preset Status Not Localizable
**What goes wrong:** Preset status text hardcoded in English
**Why it happens:** Quick implementation with string literals
**How to avoid:**
- Store preset key ("meeting", "sick", "vacation", "focusing") not text
- Display localized text in UI, store key in database
- Note: For v0.5.0 MVP, English-only is acceptable; flag for future i18n
**Warning signs:** N/A for initial implementation

## Code Examples

Verified patterns from project conventions:

### Bookmark Server Actions
```typescript
// src/lib/actions/bookmark.ts
"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { bookmarks, messages, fileAttachments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function toggleBookmark(input: {
  type: "message" | "file";
  messageId?: string;
  fileId?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const whereClause = input.type === "message"
    ? and(
        eq(bookmarks.userId, session.user.id),
        eq(bookmarks.messageId, input.messageId!)
      )
    : and(
        eq(bookmarks.userId, session.user.id),
        eq(bookmarks.fileId, input.fileId!)
      );

  const existing = await db.query.bookmarks.findFirst({
    where: whereClause,
  });

  if (existing) {
    // Remove bookmark
    await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
    return { bookmarked: false };
  } else {
    // Add bookmark
    await db.insert(bookmarks).values({
      userId: session.user.id,
      type: input.type,
      messageId: input.type === "message" ? input.messageId : null,
      fileId: input.type === "file" ? input.fileId : null,
    });
    return { bookmarked: true };
  }
}

export async function getBookmarks() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return db.query.bookmarks.findMany({
    where: eq(bookmarks.userId, session.user.id),
    orderBy: [desc(bookmarks.createdAt)],
    with: {
      message: {
        with: {
          author: true,
          channel: true,
          conversation: true,
        },
      },
      file: {
        with: {
          uploader: true,
          message: {
            with: { channel: true, conversation: true },
          },
        },
      },
    },
  });
}

export async function isBookmarked(messageId: string): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return false;

  const bookmark = await db.query.bookmarks.findFirst({
    where: and(
      eq(bookmarks.userId, session.user.id),
      eq(bookmarks.messageId, messageId)
    ),
  });

  return !!bookmark;
}
```

### Status Server Actions
```typescript
// src/lib/actions/user-status.ts
"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { userStatuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { statusExpirationQueue } from "@/server/queue/status-expiration.queue";

// Preset status options
export const STATUS_PRESETS = [
  { key: "meeting", emoji: "📅", text: "In a meeting" },
  { key: "sick", emoji: "🤒", text: "Out sick" },
  { key: "vacation", emoji: "🌴", text: "On vacation" },
  { key: "focusing", emoji: "🎯", text: "Focusing" },
] as const;

export async function setUserStatus(input: {
  emoji?: string;
  text?: string;
  expiresAt?: Date;
  dndEnabled?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Validate text length
  if (input.text && input.text.length > 100) {
    throw new Error("Status text must be 100 characters or less");
  }

  const userId = session.user.id;

  // Get existing status to cancel old job
  const existing = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
  });

  // Cancel existing expiration job
  if (existing?.jobId) {
    try {
      const job = await statusExpirationQueue.getJob(existing.jobId);
      if (job) await job.remove();
    } catch (e) {
      // Job may not exist, ignore
    }
  }

  // Upsert status
  const [status] = await db.insert(userStatuses)
    .values({
      userId,
      emoji: input.emoji || null,
      text: input.text || null,
      expiresAt: input.expiresAt || null,
      dndEnabled: input.dndEnabled ?? false,
    })
    .onConflictDoUpdate({
      target: userStatuses.userId,
      set: {
        emoji: input.emoji || null,
        text: input.text || null,
        expiresAt: input.expiresAt || null,
        dndEnabled: input.dndEnabled ?? false,
        updatedAt: new Date(),
        jobId: null, // Clear old job ID
      },
    })
    .returning();

  // Schedule new expiration job if needed
  if (input.expiresAt && input.expiresAt > new Date()) {
    const delay = input.expiresAt.getTime() - Date.now();
    const job = await statusExpirationQueue.add(
      "clear-status",
      { userId },
      { delay, jobId: `status-${userId}` }
    );

    await db.update(userStatuses)
      .set({ jobId: job.id })
      .where(eq(userStatuses.id, status.id));
  }

  return status;
}

export async function clearUserStatus() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const existing = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, session.user.id),
  });

  if (existing) {
    // Cancel expiration job
    if (existing.jobId) {
      try {
        const job = await statusExpirationQueue.getJob(existing.jobId);
        if (job) await job.remove();
      } catch (e) {
        // Job may not exist, ignore
      }
    }

    // Delete status
    await db.delete(userStatuses)
      .where(eq(userStatuses.userId, session.user.id));
  }

  return { cleared: true };
}

export async function getUserStatus(userId: string) {
  return db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
  });
}

export async function getMyStatus() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  return db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, session.user.id),
  });
}

export async function isDndEnabled(userId: string): Promise<boolean> {
  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
    columns: { dndEnabled: true },
  });
  return status?.dndEnabled ?? false;
}
```

### Bookmark Button Component
```typescript
// src/components/bookmark/bookmark-button.tsx
"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleBookmark } from "@/lib/actions/bookmark";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  messageId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({ messageId, initialBookmarked = false }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    // Optimistic update
    setIsBookmarked(!isBookmarked);

    startTransition(async () => {
      try {
        const result = await toggleBookmark({ type: "message", messageId });
        setIsBookmarked(result.bookmarked);
      } catch (error) {
        // Revert on error
        setIsBookmarked(isBookmarked);
        console.error("Failed to toggle bookmark:", error);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "transition-opacity h-7 w-7 p-0",
        isBookmarked
          ? "opacity-100 text-yellow-500 hover:text-yellow-600"
          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-500"
      )}
      onClick={handleToggle}
      disabled={isPending}
    >
      <Bookmark className={cn("h-4 w-4", isBookmarked && "fill-current")} />
      <span className="sr-only">{isBookmarked ? "Remove bookmark" : "Bookmark message"}</span>
    </Button>
  );
}
```

### Status Editor Component
```typescript
// src/components/status/status-editor.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setUserStatus, clearUserStatus, STATUS_PRESETS } from "@/lib/actions/user-status";
import { addHours, addDays } from "date-fns";

interface StatusEditorProps {
  currentStatus?: {
    emoji: string | null;
    text: string | null;
    expiresAt: Date | null;
    dndEnabled: boolean;
  };
  onClose?: () => void;
}

const EXPIRATION_OPTIONS = [
  { label: "30 minutes", value: () => addHours(new Date(), 0.5) },
  { label: "1 hour", value: () => addHours(new Date(), 1) },
  { label: "4 hours", value: () => addHours(new Date(), 4) },
  { label: "Today", value: () => new Date(new Date().setHours(23, 59, 59, 999)) },
  { label: "This week", value: () => addDays(new Date(), 7) },
  { label: "Don't clear", value: () => null },
] as const;

export function StatusEditor({ currentStatus, onClose }: StatusEditorProps) {
  const [emoji, setEmoji] = useState(currentStatus?.emoji || "");
  const [text, setText] = useState(currentStatus?.text || "");
  const [expiresAt, setExpiresAt] = useState<Date | null>(currentStatus?.expiresAt || null);
  const [dndEnabled, setDndEnabled] = useState(currentStatus?.dndEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePreset = (preset: typeof STATUS_PRESETS[number]) => {
    setEmoji(preset.emoji);
    setText(preset.text);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setUserStatus({
        emoji: emoji || undefined,
        text: text || undefined,
        expiresAt: expiresAt || undefined,
        dndEnabled,
      });
      onClose?.();
    } catch (error) {
      console.error("Failed to set status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await clearUserStatus();
      setEmoji("");
      setText("");
      setExpiresAt(null);
      setDndEnabled(false);
      onClose?.();
    } catch (error) {
      console.error("Failed to clear status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 w-80">
      {/* Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick presets</Label>
        <div className="flex flex-wrap gap-1">
          {STATUS_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset(preset)}
            >
              {preset.emoji} {preset.text}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom status */}
      <div className="space-y-2">
        <Label htmlFor="status-text">Custom status</Label>
        <div className="flex gap-2">
          <Input
            id="status-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(-2))} // Take last emoji
            placeholder="😀"
            className="w-12 text-center"
            maxLength={2}
          />
          <Input
            id="status-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 100))}
            placeholder="What's your status?"
            className="flex-1"
            maxLength={100}
          />
        </div>
        <p className="text-xs text-muted-foreground">{text.length}/100 characters</p>
      </div>

      {/* Expiration */}
      <div className="space-y-2">
        <Label>Clear status after</Label>
        <div className="flex flex-wrap gap-1">
          {EXPIRATION_OPTIONS.map((option) => (
            <Button
              key={option.label}
              variant={expiresAt?.getTime() === option.value()?.getTime() ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpiresAt(option.value())}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* DND toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="dnd">Pause notifications</Label>
          <p className="text-xs text-muted-foreground">Enable Do Not Disturb</p>
        </div>
        <Switch
          id="dnd"
          checked={dndEnabled}
          onCheckedChange={setDndEnabled}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isSaving || (!currentStatus?.text && !currentStatus?.emoji)}
        >
          Clear status
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
```

### Status Expiration Worker
```typescript
// src/workers/status-expiration.worker.ts
import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userStatuses } from "@/db/schema";
import { getQueueConnection } from "@/server/queue/connection";
import type { StatusExpirationJobData } from "@/server/queue/status-expiration.queue";

async function processStatusExpiration(job: Job<StatusExpirationJobData>) {
  const { userId } = job.data;

  console.log(`[Status Worker] Processing status expiration for user ${userId}`);

  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
  });

  if (!status) {
    console.log(`[Status Worker] No status found for user ${userId}, skipping`);
    return { success: true, skipped: true };
  }

  // Verify this job is still the active one
  if (status.jobId !== job.id) {
    console.log(`[Status Worker] Job ID mismatch, status was updated, skipping`);
    return { success: true, skipped: true };
  }

  // Clear the status
  await db.delete(userStatuses).where(eq(userStatuses.userId, userId));

  console.log(`[Status Worker] Cleared status for user ${userId}`);
  return { success: true };
}

export function createStatusExpirationWorker(): Worker<StatusExpirationJobData> {
  const worker = new Worker<StatusExpirationJobData>(
    "status-expiration",
    processStatusExpiration,
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );

  worker.on("failed", (job, error) => {
    console.error(`[Status Worker] Job ${job?.id} failed:`, error);
  });

  worker.on("completed", (job, result) => {
    if (result.skipped) {
      console.log(`[Status Worker] Job ${job.id} skipped`);
    } else {
      console.log(`[Status Worker] Job ${job.id} completed`);
    }
  });

  console.log("[Status Worker] Worker started");
  return worker;
}
```

### DND Check Integration
```typescript
// Update src/lib/push/send.ts
import { db } from "@/db";
import { userStatuses } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if a user has DND enabled.
 * Exported for use in other notification points.
 */
export async function isUserDndEnabled(userId: string): Promise<boolean> {
  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
    columns: { dndEnabled: true },
  });
  return status?.dndEnabled ?? false;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number; dndBlocked?: boolean }> {
  // Check DND status first (STAT-06)
  if (await isUserDndEnabled(userId)) {
    console.log(`[Push] User ${userId} has DND enabled, skipping notification`);
    return { sent: 0, failed: 0, removed: 0, dndBlocked: true };
  }

  // ... existing push logic unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Emoji picker libraries | Native emoji input | Always | Status uses single emoji; full picker unnecessary |
| Polling for status | Fetch on demand with cache | Always | Status changes rarely; real-time not needed |
| Separate bookmark tables | Polymorphic table | Pattern standard | Cleaner schema, shared queries |
| Manual expiration checks | BullMQ delayed jobs | Phase 25 | Already have infrastructure |

**Deprecated/outdated:**
- emoji-mart/emoji-picker-react: Overkill for single-emoji status input; use native input or preset buttons
- Real-time status sync: Status changes infrequently; event-driven updates unnecessary

## Open Questions

Things that couldn't be fully resolved:

1. **Status visibility across workspaces**
   - What we know: User status is per-user, not per-workspace
   - What's unclear: Should status be visible in all workspaces user belongs to?
   - Recommendation: Status is global to user, visible everywhere. Simplifies implementation.

2. **Bookmark organization (folders/tags)**
   - What we know: Requirements only specify flat list
   - What's unclear: Future need for folders or tags to organize bookmarks?
   - Recommendation: Implement flat list for v0.5.0; schema allows adding categoryId column later if needed.

3. **Status real-time sync priority**
   - What we know: Presence uses Socket.IO for real-time updates
   - What's unclear: How important is instant status text sync vs presence dot?
   - Recommendation: Don't add Socket.IO events for status changes. Fetch on demand. Status changes are rare; UI refreshes on navigation anyway. Can add later if users request.

## Sources

### Primary (HIGH confidence)
- Project codebase analysis - Existing patterns for db schema, server actions, components, BullMQ, Socket.IO
- Phase 25 RESEARCH.md - BullMQ patterns already validated and implemented
- Existing presence handler (src/server/socket/handlers/presence.ts) - Pattern for presence management
- Existing notification settings (src/db/schema/channel-notification-settings.ts) - Pattern for per-user settings

### Secondary (MEDIUM confidence)
- drizzle-orm documentation - Polymorphic relations, upsert syntax
- BullMQ documentation - Delayed job patterns (already verified in Phase 25)

### Tertiary (LOW confidence)
- N/A - All patterns derived from existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only existing libraries, no new dependencies
- Architecture: HIGH - Follows established codebase patterns exactly
- Pitfalls: HIGH - Common issues identified from similar features in codebase
- Database schema: HIGH - Follows existing schema patterns (reminders, notifications, etc.)
- DND integration: HIGH - Clear integration point in push notification function

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (stable patterns, uses existing infrastructure)
