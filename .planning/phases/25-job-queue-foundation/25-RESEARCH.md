# Phase 25: Job Queue Foundation - Research

**Researched:** 2026-01-20
**Domain:** BullMQ job queue infrastructure, scheduled messages, reminders
**Confidence:** HIGH

## Summary

This phase implements BullMQ-based job queue infrastructure enabling scheduled message delivery and message reminders. BullMQ is the established standard for Redis-based job queues in Node.js, providing persistence across restarts, delayed job scheduling, and repeatable job patterns essential for this feature set.

The implementation requires a separate worker process from the Next.js server to handle job processing without blocking web requests. Database tables will track scheduled messages and reminders with status management, while the worker processes jobs and triggers message delivery or reminder notifications via existing Socket.IO and push notification infrastructure.

**Primary recommendation:** Run BullMQ worker as a separate process (tsx script in development, separate container/process in production) using ioredis with existing REDIS_URL configuration. Store scheduled messages and reminders in PostgreSQL with status tracking, using BullMQ job IDs for correlation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | ^5.66.5 | Job queue system | Already selected in project research; modern Redis-based queue with persistence |
| ioredis | ^5.9.2 | Redis client | Already in use; required by BullMQ |
| date-fns | ^4.1.0 | Date manipulation | Already in use; v4 has first-class timezone support via @date-fns/tz |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @date-fns/tz | (included in v4) | Timezone handling | Converting user local times to UTC for scheduling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| BullMQ | node-cron | node-cron is in-memory only, jobs lost on restart - unacceptable for scheduled messages |
| BullMQ | Agenda | MongoDB-based; adds dependency; BullMQ better with existing Redis setup |
| @date-fns/tz | Luxon | More comprehensive but adds 70KB; date-fns already in project |

**Installation:**
```bash
npm install bullmq
# ioredis and date-fns already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server/
│   ├── queue/
│   │   ├── index.ts           # Queue definitions, shared connection
│   │   ├── scheduled-message.queue.ts  # Scheduled message queue + job data types
│   │   ├── reminder.queue.ts  # Reminder queue + job data types
│   │   └── connection.ts      # Redis connection factory for BullMQ
│   └── index.ts               # Existing Next.js server (no worker code here)
├── workers/
│   ├── index.ts               # Worker entry point (runs as separate process)
│   ├── scheduled-message.worker.ts  # Processes scheduled messages
│   └── reminder.worker.ts     # Processes reminders
├── db/schema/
│   ├── scheduled-message.ts   # New: scheduled_messages table
│   └── reminder.ts            # New: reminders table
├── lib/actions/
│   ├── scheduled-message.ts   # Server actions for CRUD
│   └── reminder.ts            # Server actions for CRUD
└── components/
    ├── schedule/
    │   ├── schedule-send-dropdown.tsx  # Dropdown on Send button
    │   ├── scheduled-messages-list.tsx # List view for sidebar
    │   └── scheduled-message-edit-dialog.tsx
    └── reminder/
        ├── reminder-menu-item.tsx      # "Remind me..." in message menu
        ├── reminders-list.tsx          # List view for sidebar
        ├── reminder-detail-panel.tsx   # Sheet panel for fired reminders
        └── snooze-options.tsx          # Snooze interval selector
```

### Pattern 1: Separate Worker Process
**What:** BullMQ worker runs as an independent Node.js process, not inside Next.js
**When to use:** Always for production; prevents blocking web request handling
**Example:**
```typescript
// workers/index.ts - Worker entry point
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createScheduledMessageWorker } from "./scheduled-message.worker";
import { createReminderWorker } from "./reminder.worker";

// Workers auto-start on instantiation
const scheduledMessageWorker = createScheduledMessageWorker();
const reminderWorker = createReminderWorker();

console.log("[Worker] BullMQ workers started");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await scheduledMessageWorker.close();
  await reminderWorker.close();
  process.exit(0);
});
```

**package.json script:**
```json
{
  "scripts": {
    "worker": "dotenv -e .env.local -- npx tsx --watch src/workers/index.ts",
    "worker:prod": "node dist/workers/index.js"
  }
}
```

### Pattern 2: Database + Queue Correlation
**What:** Store job metadata in PostgreSQL, use BullMQ for scheduling. Job ID stored in DB for management.
**When to use:** Always for scheduled messages and reminders - enables UI management
**Example:**
```typescript
// Creating a scheduled message
async function scheduleMessage(data: ScheduleMessageInput) {
  // 1. Insert into database with "pending" status
  const [scheduled] = await db.insert(scheduledMessages).values({
    authorId: data.authorId,
    content: data.content,
    channelId: data.channelId,
    conversationId: data.conversationId,
    scheduledFor: data.scheduledFor, // UTC timestamp
    status: "pending",
  }).returning();

  // 2. Add delayed job to BullMQ
  const delay = data.scheduledFor.getTime() - Date.now();
  const job = await scheduledMessageQueue.add(
    "send",
    { scheduledMessageId: scheduled.id },
    { delay, jobId: `scheduled-${scheduled.id}` }
  );

  // 3. Store job ID in database for management
  await db.update(scheduledMessages)
    .set({ jobId: job.id })
    .where(eq(scheduledMessages.id, scheduled.id));

  return scheduled;
}
```

### Pattern 3: Worker Job Processing
**What:** Worker fetches job data from database, performs action, updates status
**When to use:** For all job processors
**Example:**
```typescript
// workers/scheduled-message.worker.ts
import { Worker } from "bullmq";
import { db } from "@/db";
import { scheduledMessages, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getQueueConnection } from "@/server/queue/connection";

export function createScheduledMessageWorker() {
  return new Worker(
    "scheduled-messages",
    async (job) => {
      const { scheduledMessageId } = job.data;

      // Fetch scheduled message from DB
      const scheduled = await db.query.scheduledMessages.findFirst({
        where: eq(scheduledMessages.id, scheduledMessageId),
      });

      if (!scheduled || scheduled.status !== "pending") {
        return { skipped: true, reason: "Not pending" };
      }

      // Update status to processing
      await db.update(scheduledMessages)
        .set({ status: "processing" })
        .where(eq(scheduledMessages.id, scheduledMessageId));

      try {
        // Create the actual message
        const [newMessage] = await db.insert(messages).values({
          content: scheduled.content,
          authorId: scheduled.authorId,
          channelId: scheduled.channelId,
          conversationId: scheduled.conversationId,
          sequence: /* atomic sequence generation */,
        }).returning();

        // Mark as sent
        await db.update(scheduledMessages)
          .set({ status: "sent", sentAt: new Date(), messageId: newMessage.id })
          .where(eq(scheduledMessages.id, scheduledMessageId));

        // Broadcast via Socket.IO (need to emit to room)
        // Worker can connect to Redis and use Socket.IO adapter

        return { success: true, messageId: newMessage.id };
      } catch (error) {
        await db.update(scheduledMessages)
          .set({ status: "failed", error: String(error) })
          .where(eq(scheduledMessages.id, scheduledMessageId));
        throw error; // Re-throw to trigger BullMQ retry
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );
}
```

### Pattern 4: Timezone Handling (Implicit User Timezone)
**What:** Detect user's timezone on client, convert to UTC for storage/scheduling
**When to use:** When user selects a time via datetime-local input
**Example:**
```typescript
// Client-side: Convert local datetime-local value to UTC
function scheduleAtLocalTime(localDateTimeString: string) {
  // datetime-local gives "2025-01-20T09:00" (no timezone)
  // Browser interprets this as local time
  const localDate = new Date(localDateTimeString);

  // This is already a UTC timestamp internally
  // Send to server as ISO string (UTC)
  const scheduledFor = localDate.toISOString();

  return createScheduledMessage({ ...data, scheduledFor });
}

// Server-side: Already in UTC, store directly
// Display: Format in user's timezone for UI
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

function formatInUserTimezone(utcDate: Date, userTimezone: string) {
  const tzDate = new TZDate(utcDate, userTimezone);
  return format(tzDate, "MMM d 'at' h:mm a");
}
```

### Pattern 5: Recurring Reminders with Job Schedulers
**What:** Use BullMQ's upsertJobScheduler for daily/weekly recurring reminders
**When to use:** For RMND-07 recurring reminders
**Example:**
```typescript
// Creating a recurring reminder
async function createRecurringReminder(data: RecurringReminderInput) {
  const [reminder] = await db.insert(reminders).values({
    userId: data.userId,
    messageId: data.messageId,
    note: data.note,
    remindAt: data.firstRemindAt,
    recurringPattern: data.pattern, // "daily" | "weekly" | null
    status: "pending",
  }).returning();

  // For recurring, use job scheduler
  if (data.pattern) {
    const every = data.pattern === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

    await reminderQueue.upsertJobScheduler(
      `reminder-${reminder.id}`,
      { every, startDate: data.firstRemindAt },
      { name: "recurring-reminder", data: { reminderId: reminder.id } }
    );
  } else {
    // One-time: use delayed job
    const delay = data.firstRemindAt.getTime() - Date.now();
    await reminderQueue.add(
      "one-time-reminder",
      { reminderId: reminder.id },
      { delay, jobId: `reminder-${reminder.id}` }
    );
  }

  return reminder;
}
```

### Anti-Patterns to Avoid
- **Running worker inside Next.js process:** Blocks web requests, risks memory issues
- **Storing scheduled time in local timezone:** Always store UTC, convert for display
- **Not tracking job status in DB:** Lose ability to manage/cancel scheduled items
- **Using node-cron for persistence-required jobs:** Jobs lost on restart
- **Polling for due jobs:** BullMQ handles timing; use delayed jobs

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job persistence | Custom Redis polling | BullMQ delayed jobs | Handles timing, retries, persistence |
| Recurring jobs | Custom cron scheduler | BullMQ job schedulers | Prevents duplicate jobs, handles edge cases |
| Timezone conversion | Manual offset math | @date-fns/tz TZDate | DST handling, IANA timezone support |
| Job retry logic | setTimeout loops | BullMQ attempts/backoff | Exponential backoff, max attempts built-in |
| Detecting user timezone | Ask user to select | Intl.DateTimeFormat().resolvedOptions().timeZone | Browser provides automatically |

**Key insight:** BullMQ provides battle-tested scheduling primitives. The complexity is in the UI and database state management, not the job infrastructure.

## Common Pitfalls

### Pitfall 1: Worker Not Running = Silent Failures
**What goes wrong:** Scheduled messages never send because worker process isn't started
**Why it happens:** Forgetting to run worker in development, misconfigured deployment
**How to avoid:**
- Add worker health endpoint that checks queue status
- Log prominently when worker starts
- In development, use concurrently to run both server and worker
**Warning signs:** Scheduled messages stay "pending" past their time

### Pitfall 2: Redis Connection Maxed Out
**What goes wrong:** "Too many connections" errors, queue stops processing
**Why it happens:** Each Queue/Worker creates connections; many instances = many connections
**How to avoid:**
- Reuse ioredis instance for Queue classes (not Workers - they need dedicated connection)
- Set maxRetriesPerRequest: null for Worker connections
- Configure Redis maxclients appropriately
**Warning signs:** ECONNREFUSED errors, intermittent failures

### Pitfall 3: Job Data Stale After Edit
**What goes wrong:** User edits scheduled message, but old content sends
**Why it happens:** Job data stored at queue time, not re-fetched at execution
**How to avoid:**
- Store only ID in job data, fetch fresh from DB in worker
- Update database record, not job data, for edits
**Warning signs:** Edits don't reflect in sent messages

### Pitfall 4: Timezone Display Mismatch
**What goes wrong:** User schedules for 9am, sees different time in list
**Why it happens:** Storing local time, displaying in different timezone
**How to avoid:**
- Always store UTC in database
- Detect and store user's timezone preference
- Convert to user timezone only for display
**Warning signs:** Times off by hours, especially near DST transitions

### Pitfall 5: Duplicate Scheduled Messages
**What goes wrong:** Same message sends twice
**Why it happens:** Job retry after partial failure, race conditions
**How to avoid:**
- Use idempotent job IDs: `scheduled-${scheduledMessageId}`
- Check status before processing in worker
- Use database transaction for status + message creation
**Warning signs:** Duplicate messages in channel

### Pitfall 6: Memory Leak in Worker
**What goes wrong:** Worker memory grows over time, eventually crashes
**Why it happens:** Not closing old connections, holding references to completed jobs
**How to avoid:**
- Use removeOnComplete: true in job options
- Don't store job references globally
- Implement graceful shutdown
**Warning signs:** Worker restarts frequently in production

## Code Examples

Verified patterns from official sources and project conventions:

### BullMQ Queue Definition
```typescript
// src/server/queue/scheduled-message.queue.ts
import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface ScheduledMessageJobData {
  scheduledMessageId: string;
}

export const scheduledMessageQueue = new Queue<ScheduledMessageJobData>(
  "scheduled-messages",
  {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }
);
```

### Redis Connection Factory
```typescript
// src/server/queue/connection.ts
import { Redis } from "ioredis";

let queueConnection: Redis | null = null;

export function getQueueConnection(): Redis {
  if (!queueConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    queueConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ workers
    });
  }
  return queueConnection;
}
```

### Database Schema: Scheduled Messages
```typescript
// src/db/schema/scheduled-message.ts
import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";
import { messages } from "./message";

export const scheduledMessageStatusEnum = pgEnum("scheduled_message_status", [
  "pending",
  "processing",
  "sent",
  "cancelled",
  "failed",
]);

export const scheduledMessages = pgTable("scheduled_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: scheduledMessageStatusEnum("status").notNull().default("pending"),
  jobId: text("job_id"), // BullMQ job ID for management
  messageId: uuid("message_id") // Populated after sending
    .references(() => messages.id, { onDelete: "set null" }),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scheduledMessagesRelations = relations(scheduledMessages, ({ one }) => ({
  author: one(users, {
    fields: [scheduledMessages.authorId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [scheduledMessages.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [scheduledMessages.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [scheduledMessages.messageId],
    references: [messages.id],
  }),
}));
```

### Database Schema: Reminders
```typescript
// src/db/schema/reminder.ts
import { pgTable, text, timestamp, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { messages } from "./message";

export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",
  "fired",
  "snoozed",
  "completed",
  "cancelled",
]);

export const reminderPatternEnum = pgEnum("reminder_pattern", [
  "daily",
  "weekly",
]);

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  note: text("note"), // Optional user note
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  status: reminderStatusEnum("status").notNull().default("pending"),
  recurringPattern: reminderPatternEnum("recurring_pattern"),
  jobId: text("job_id"),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("reminders_user_status_idx").on(table.userId, table.status),
  index("reminders_remind_at_idx").on(table.remindAt),
]);

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, {
    fields: [reminders.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [reminders.messageId],
    references: [messages.id],
  }),
}));
```

### Socket.IO Event Extensions
```typescript
// Add to src/lib/socket-events.ts
export interface Reminder {
  id: string;
  messageId: string;
  note: string | null;
  remindAt: Date;
  status: "pending" | "fired" | "snoozed" | "completed" | "cancelled";
  recurringPattern: "daily" | "weekly" | null;
  message?: Message; // Populated for display
}

// Add to ServerToClientEvents
"reminder:fired": (data: {
  reminder: Reminder;
  message: Message;
}) => void;

"reminder:updated": (data: {
  reminderId: string;
  status: Reminder["status"];
  snoozedUntil?: Date;
}) => void;
```

### Worker Broadcasting to Socket.IO
```typescript
// workers/reminder.worker.ts - Emitting to Socket.IO from worker
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Server } from "socket.io";

// Create a minimal Socket.IO server just for emitting
function createEmitter() {
  const pubClient = new Redis(process.env.REDIS_URL!);
  const subClient = pubClient.duplicate();

  const io = new Server();
  io.adapter(createAdapter(pubClient, subClient));

  return io;
}

const emitter = createEmitter();

// In worker processor:
// Emit to user's room
emitter.to(`user:${reminder.userId}`).emit("reminder:fired", {
  reminder: reminderData,
  message: messageData,
});
```

### Schedule Send Dropdown Component Pattern
```typescript
// src/components/schedule/schedule-send-dropdown.tsx
"use client";

import { useState } from "react";
import { ChevronDown, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addDays, setHours, setMinutes, nextMonday } from "date-fns";

interface ScheduleSendDropdownProps {
  onSendNow: () => void;
  onSchedule: (scheduledFor: Date) => void;
  disabled?: boolean;
}

export function ScheduleSendDropdown({
  onSendNow,
  onSchedule,
  disabled,
}: ScheduleSendDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");

  // Quick-pick presets
  const tomorrow9am = setMinutes(setHours(addDays(new Date(), 1), 9), 0);
  const nextMon9am = setMinutes(setHours(nextMonday(new Date()), 9), 0);

  const handleQuickPick = (date: Date) => {
    onSchedule(date);
    setIsOpen(false);
  };

  const handleCustomSchedule = () => {
    if (customDateTime) {
      const scheduledDate = new Date(customDateTime);
      onSchedule(scheduledDate);
      setIsOpen(false);
      setShowCustom(false);
      setCustomDateTime("");
    }
  };

  return (
    <div className="flex">
      <Button
        type="button"
        onClick={onSendNow}
        disabled={disabled}
        className="rounded-r-none"
      >
        <Send className="h-4 w-4" />
      </Button>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            className="rounded-l-none border-l px-2"
            variant="default"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <div className="space-y-1">
            <button
              className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              onClick={() => handleQuickPick(tomorrow9am)}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Tomorrow at 9:00 AM
            </button>
            <button
              className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
              onClick={() => handleQuickPick(nextMon9am)}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Monday at 9:00 AM
            </button>
            <hr className="my-2" />
            {showCustom ? (
              <div className="p-2 space-y-2">
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleCustomSchedule}
                  disabled={!customDateTime}
                >
                  Schedule
                </Button>
              </div>
            ) : (
              <button
                className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
                onClick={() => setShowCustom(true)}
              >
                Custom time...
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| QueueScheduler class | Built into Worker | BullMQ 2.0 | No need to instantiate QueueScheduler separately |
| Repeatable jobs via add() | upsertJobScheduler() | BullMQ 5.16.0 | Prevents duplicate schedulers on redeploy |
| moment-timezone | date-fns v4 with @date-fns/tz | date-fns 4.0 (2024) | Native timezone support, smaller bundle |
| Manual job deduplication | jobId option | Always available | Use unique IDs to prevent duplicates |

**Deprecated/outdated:**
- `QueueScheduler` class: No longer needed in BullMQ 2.0+, functionality merged into Worker
- `repeat` option on `add()` for new schedulers: Use `upsertJobScheduler()` instead to prevent duplicates
- moment-timezone: Use date-fns v4 with TZDate for timezone handling

## Open Questions

Things that couldn't be fully resolved:

1. **Socket.IO emission from worker process**
   - What we know: Worker runs separately from Next.js server; need to broadcast message:new when scheduled message sends
   - What's unclear: Best pattern for worker-to-client communication - create emitter-only Socket.IO instance with Redis adapter, or use a different approach
   - Recommendation: Create minimal Socket.IO server in worker with Redis adapter for emitting only; this leverages existing adapter infrastructure

2. **File attachments on scheduled messages**
   - What we know: Current messages support attachments via fileAttachments table
   - What's unclear: Should scheduled messages support attachments? Adds complexity for attachment lifecycle management
   - Recommendation: Defer attachment support for scheduled messages to future enhancement; focus on text-only scheduling first

3. **Reminder notification aggregation**
   - What we know: Multiple reminders could fire at similar times
   - What's unclear: Should multiple reminders be grouped into single notification?
   - Recommendation: Keep notifications separate for MVP; add aggregation if users request it

## Sources

### Primary (HIGH confidence)
- [BullMQ Official Documentation](https://docs.bullmq.io) - Jobs, workers, events, connections
- [BullMQ Delayed Jobs](https://docs.bullmq.io/guide/jobs/delayed) - Delay implementation
- [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) - Recurring job patterns
- [BullMQ Workers](https://docs.bullmq.io/guide/workers) - Worker configuration
- [date-fns v4 Timezone Support](https://blog.date-fns.org/v40-with-time-zone-support/) - TZDate usage
- Project codebase analysis - Existing patterns for Redis, Socket.IO, Drizzle

### Secondary (MEDIUM confidence)
- [Integrating BullMQ with Next.js](https://medium.com/@asanka_l/integrating-bullmq-with-nextjs-typescript-f41cca347ef8) - Separate worker pattern
- [BullMQ Guide on DragonflyDB](https://www.dragonflydb.io/guides/bullmq) - Comprehensive patterns
- [MDN datetime-local](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local) - Input handling

### Tertiary (LOW confidence)
- Various Medium articles on BullMQ patterns - Cross-verified with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - BullMQ is clearly the standard, already selected in project research
- Architecture: HIGH - Separate worker pattern is well-documented and standard
- Pitfalls: HIGH - Common issues well-documented in BullMQ community
- Database schema: HIGH - Follows existing project patterns for Drizzle
- Socket.IO integration from worker: MEDIUM - Pattern exists but needs validation

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (stable libraries, patterns unlikely to change)
