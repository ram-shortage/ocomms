# Phase 23: Notes - Research

**Researched:** 2026-01-20
**Domain:** Markdown notes with conflict detection (channel-shared and personal scratchpads)
**Confidence:** HIGH

## Summary

Phase 23 implements markdown notes for OComms channels and personal scratchpads. Each channel has one shared markdown document accessible from the channel header, and each user has a personal notes scratchpad per workspace.

The project has already made key decisions in STATE.md:
1. **react-markdown** for rendering (XSS-safe, no dangerouslySetInnerHTML)
2. **Last-write-wins with conflict detection** (not CRDT/OT)

Key findings:
1. **react-markdown v10** is React 19 compatible (v9.0.2 fixed types) and provides XSS-safe rendering by converting markdown to React components
2. **Simple edit/preview toggle** is the recommended pattern - textarea for editing, react-markdown for preview
3. **Conflict detection via version column** - optimistic locking pattern where version is checked on save, user warned if concurrent edit detected
4. **Database schema** - Two tables: `channel_notes` (one per channel) and `personal_notes` (one per user per workspace)
5. **Socket.IO integration** - Add `note:updated` event to notify other users viewing same note of changes

**Primary recommendation:** Build a simple edit/preview toggle component using native textarea for editing and react-markdown for preview. Implement optimistic locking with version column for conflict detection. No external editor libraries needed.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^10.1.0 | Markdown rendering | XSS-safe (no dangerouslySetInnerHTML), React 19 compatible (v9.0.2 fixed types), renders to React components |
| remark-gfm | ^4.0.0 | GitHub Flavored Markdown | Tables, strikethrough, task lists, autolinks - users expect these |
| rehype-highlight | ^7.0.0 | Syntax highlighting | Code block highlighting for technical notes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.562.0 | Icons | Already installed. Use FileText, Edit, Eye, Save icons |
| sonner | ^2.0.7 | Toast notifications | Already installed. Show save success, conflict warnings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | @uiw/react-md-editor | Full editor with toolbar. Heavier bundle (~4.6KB vs ~8KB for react-markdown). Adds complexity when simple textarea + preview works. |
| react-markdown | MDXEditor | Rich WYSIWYG. 851KB gzipped - overkill. Known inline rendering issues. |
| react-markdown | Tiptap | Full WYSIWYG framework. React 19 compatibility still maturing. Complex for markdown-only use case. |
| react-markdown | marked/markdown-it | Returns HTML strings. Requires dangerouslySetInnerHTML. Security risk. |
| Native textarea | CodeMirror/Monaco | Full code editors. Massive bundles. Overkill for markdown notes. |

**Installation:**
```bash
npm install react-markdown remark-gfm rehype-highlight
```

**Bundle Size Impact:**
| Package | Gzipped Size |
|---------|--------------|
| react-markdown | ~8KB |
| remark-gfm | ~4KB |
| rehype-highlight | ~25KB (includes highlight.js subset) |
| **Total** | ~37KB |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── notes/
│           ├── channel/
│           │   └── route.ts        # GET/PUT channel note
│           └── personal/
│               └── route.ts        # GET/PUT personal note
├── components/
│   └── notes/
│       ├── note-editor.tsx         # Edit/preview toggle component
│       ├── note-viewer.tsx         # Read-only markdown display
│       ├── note-toolbar.tsx        # Formatting toolbar (bold, italic, link)
│       └── conflict-dialog.tsx     # Conflict resolution dialog
├── db/
│   └── schema/
│       ├── channel-note.ts         # Channel notes schema
│       └── personal-note.ts        # Personal notes schema
├── lib/
│   └── actions/
│       └── notes.ts                # Server actions for notes CRUD
└── server/
    └── socket/
        └── notes.ts                # Socket.IO handlers for note events
```

### Pattern 1: Edit/Preview Toggle Component
**What:** Simple component that toggles between textarea (edit mode) and react-markdown (preview mode)
**When to use:** All note editing scenarios
**Example:**
```typescript
// Source: Project patterns + react-markdown official docs
"use client";

import { useState, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Eye, Save } from "lucide-react";

interface NoteEditorProps {
  initialContent: string;
  initialVersion: number;
  onSave: (content: string, baseVersion: number) => Promise<{
    success: boolean;
    newVersion?: number;
    conflict?: {
      serverContent: string;
      serverVersion: number;
      editedBy: string;
    };
  }>;
  readOnly?: boolean;
}

export function NoteEditor({
  initialContent,
  initialVersion,
  onSave,
  readOnly = false
}: NoteEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [content, setContent] = useState(initialContent);
  const [baseVersion, setBaseVersion] = useState(initialVersion);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    debounce(async (newContent: string) => {
      if (newContent === initialContent) return;
      setSaving(true);
      const result = await onSave(newContent, baseVersion);
      setSaving(false);
      if (result.success && result.newVersion) {
        setBaseVersion(result.newVersion);
        setHasChanges(false);
      } else if (result.conflict) {
        // Show conflict dialog
      }
    }, 2000),
    [baseVersion, onSave]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(true);
    debouncedSave(e.target.value);
  };

  if (readOnly || mode === "preview") {
    return (
      <div className="relative">
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode("edit")}
            className="absolute top-2 right-2"
          >
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
        <div className="prose dark:prose-invert max-w-none p-4">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content || "*No content yet*"}
          </Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("preview")}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saving && "Saving..."}
          {hasChanges && !saving && "Unsaved changes"}
        </div>
      </div>
      <Textarea
        value={content}
        onChange={handleChange}
        placeholder="Write your note in Markdown..."
        className="flex-1 font-mono text-sm resize-none border-0 focus-visible:ring-0"
      />
    </div>
  );
}
```

### Pattern 2: Optimistic Locking with Version Column
**What:** Check version on save to detect concurrent edits
**When to use:** Any shared editable resource (channel notes)
**Example:**
```typescript
// Source: Optimistic concurrency control patterns
// API route: src/app/api/notes/channel/route.ts

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { channelId, content, baseVersion } = await request.json();

  // Verify user is channel member
  const membership = await db.query.channelMembers.findFirst({
    where: and(
      eq(channelMembers.channelId, channelId),
      eq(channelMembers.userId, session.user.id)
    ),
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a channel member" }, { status: 403 });
  }

  // Atomic update with version check
  const result = await db
    .update(channelNotes)
    .set({
      content,
      version: sql`${channelNotes.version} + 1`,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelNotes.channelId, channelId),
        eq(channelNotes.version, baseVersion) // Only update if version matches
      )
    )
    .returning();

  if (result.length === 0) {
    // Version mismatch = conflict
    const currentNote = await db.query.channelNotes.findFirst({
      where: eq(channelNotes.channelId, channelId),
      with: { updatedByUser: true },
    });

    return NextResponse.json({
      success: false,
      conflict: {
        serverContent: currentNote?.content,
        serverVersion: currentNote?.version,
        editedBy: currentNote?.updatedByUser?.name || "Another user",
      },
    }, { status: 409 });
  }

  // Emit Socket.IO event for other viewers
  const io = getIO();
  io.to(`channel:${channelId}`).emit("note:updated", {
    channelId,
    version: result[0].version,
    updatedBy: session.user.id,
  });

  return NextResponse.json({
    success: true,
    newVersion: result[0].version
  });
}
```

### Pattern 3: Conflict Resolution UI
**What:** Dialog shown when concurrent edit detected
**When to use:** When save fails due to version mismatch
**Example:**
```typescript
// Source: Project dialog patterns
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConflictDialogProps {
  open: boolean;
  onClose: () => void;
  editedBy: string;
  onKeepYours: () => void;
  onKeepTheirs: () => void;
}

export function ConflictDialog({
  open,
  onClose,
  editedBy,
  onKeepYours,
  onKeepTheirs,
}: ConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Conflict Detected</DialogTitle>
          <DialogDescription>
            This note was edited by {editedBy} while you were editing.
            Choose which version to keep.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onKeepTheirs}>
            Keep their version
          </Button>
          <Button onClick={onKeepYours}>
            Keep your version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 4: Socket.IO Note Events
**What:** Real-time notification when note is updated
**When to use:** Notify viewers that note content changed
**Example:**
```typescript
// Source: Existing socket-events.ts patterns
// Add to src/lib/socket-events.ts

export interface ServerToClientEvents {
  // ... existing events ...
  "note:updated": (data: {
    channelId?: string;
    workspaceId?: string; // For personal notes
    version: number;
    updatedBy: string;
  }) => void;
}

export interface ClientToServerEvents {
  // ... existing events ...
  "note:subscribe": (data: { channelId?: string; workspaceId?: string }) => void;
  "note:unsubscribe": (data: { channelId?: string; workspaceId?: string }) => void;
}
```

### Anti-Patterns to Avoid
- **Real-time collaborative editing:** Explicitly out of scope. Would require CRDT/OT implementation (months of work).
- **Multiple notes per channel:** Adds complexity. One note per channel is the Slack Canvas model.
- **Full WYSIWYG editor:** Heavy bundles, complexity. Markdown + toolbar + preview is sufficient.
- **dangerouslySetInnerHTML:** Never use with markdown. react-markdown renders to React components safely.
- **Storing raw HTML:** Store markdown source, render at display time.
- **Pessimistic locking:** Blocks other users from viewing/editing. Optimistic locking is more collaborative.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom parser | react-markdown | Battle-tested, handles edge cases, XSS-safe |
| GFM syntax | Manual implementations | remark-gfm | Tables, task lists, strikethrough work out of box |
| Syntax highlighting | Custom highlighter | rehype-highlight | Handles all languages, theme support |
| Conflict detection | Complex merge logic | Version column + optimistic locking | Industry standard pattern, simple to implement |
| Debounced save | setTimeout manually | useCallback + debounce utility | Handles cleanup, prevents stale closures |
| Markdown toolbar | Custom button handlers | Insert at cursor position utility | Standard pattern, handles selection properly |

**Key insight:** The combination of react-markdown + native textarea gives all needed functionality without the complexity and bundle size of full editor frameworks like Tiptap or MDXEditor.

## Common Pitfalls

### Pitfall 1: Using dangerouslySetInnerHTML for Markdown
**What goes wrong:** XSS vulnerabilities if markdown contains malicious scripts
**Why it happens:** Using marked/markdown-it which return HTML strings
**How to avoid:** Use react-markdown which renders to React components, never HTML strings
**Warning signs:** Seeing `dangerouslySetInnerHTML` in markdown rendering code

### Pitfall 2: No Conflict Detection on Shared Notes
**What goes wrong:** Last write silently wins, users lose work
**Why it happens:** Not tracking versions, just overwriting
**How to avoid:**
- Add version column to notes table
- Check version on save
- Show conflict dialog when version mismatch
**Warning signs:** No version column, no conflict handling code

### Pitfall 3: Blocking UI During Save
**What goes wrong:** User can't continue editing while save in progress
**Why it happens:** Awaiting save before allowing further edits
**How to avoid:**
- Debounced auto-save (2 second delay)
- Optimistic UI updates
- Save in background
**Warning signs:** "Saving..." blocks the textarea

### Pitfall 4: Not Handling Edit Mode on Mobile
**What goes wrong:** Keyboard covers textarea, can't scroll properly
**Why it happens:** Not accounting for virtual keyboard
**How to avoid:**
- Use `visualViewport` API to detect keyboard
- Scroll textarea into view when focused
- Test on real mobile devices
**Warning signs:** No mobile-specific CSS, no keyboard handling

### Pitfall 5: Lost Changes on Navigation
**What goes wrong:** User navigates away, unsaved changes lost
**Why it happens:** No beforeunload handler, no auto-save
**How to avoid:**
- Auto-save with debounce
- beforeunload warning if unsaved changes
- Save on blur/visibility change
**Warning signs:** No hasChanges state tracking

### Pitfall 6: Missing Channel Membership Check
**What goes wrong:** Users can edit notes in channels they're not members of
**Why it happens:** Only checking authentication, not authorization
**How to avoid:** Always verify channel membership before allowing note access/edit
**Warning signs:** No membership query in note API routes

## Code Examples

Verified patterns from official sources and project codebase:

### Database Schema for Notes
```typescript
// Source: Project Drizzle ORM patterns, STATE.md schema recommendations
// src/db/schema/channel-note.ts
import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channel";
import { users } from "./auth";

export const channelNotes = pgTable("channel_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("channel_notes_channel_idx").on(table.channelId), // One note per channel
]);

export const channelNotesRelations = relations(channelNotes, ({ one }) => ({
  channel: one(channels, {
    fields: [channelNotes.channelId],
    references: [channels.id],
  }),
  updatedByUser: one(users, {
    fields: [channelNotes.updatedBy],
    references: [users.id],
  }),
}));

// src/db/schema/personal-note.ts
import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";

export const personalNotes = pgTable("personal_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("personal_notes_user_org_idx").on(table.userId, table.organizationId),
]);

export const personalNotesRelations = relations(personalNotes, ({ one }) => ({
  user: one(users, {
    fields: [personalNotes.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [personalNotes.organizationId],
    references: [organizations.id],
  }),
}));
```

### Markdown Rendering with Security
```typescript
// Source: react-markdown official docs, Strapi security guide
"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface NoteViewerProps {
  content: string;
}

export function NoteViewer({ content }: NoteViewerProps) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        // Prevent javascript: URLs
        urlTransform={(url) => {
          if (url.startsWith("javascript:")) return "";
          return url;
        }}
        // Custom components for styling
        components={{
          // Open external links in new tab
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          // Add syntax highlight styles
          code: ({ className, children, ...props }) => (
            <code
              className={className}
              {...props}
            >
              {children}
            </code>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
```

### Debounce Utility
```typescript
// Source: Standard debounce pattern
// src/lib/utils/debounce.ts

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}
```

### Channel Header Notes Button
```typescript
// Source: Existing channel-header.tsx patterns
// Add to src/components/channel/channel-header.tsx

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NoteEditor } from "@/components/notes/note-editor";

interface ChannelNotesButtonProps {
  channelId: string;
  channelName: string;
}

export function ChannelNotesButton({ channelId, channelName }: ChannelNotesButtonProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" title="Channel notes">
          <FileText className="h-4 w-4" />
          <span className="sr-only">Channel notes</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>#{channelName} Notes</SheetTitle>
        </SheetHeader>
        <div className="mt-4 h-[calc(100vh-8rem)]">
          <NoteEditor channelId={channelId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| marked + dangerouslySetInnerHTML | react-markdown (React components) | 2020+ | XSS-safe, better performance |
| Full WYSIWYG editors | Markdown + preview toggle | 2023+ | Simpler, smaller bundles |
| Pessimistic locking | Optimistic locking + conflict dialog | Always best practice | Better UX, more collaborative |
| No auto-save | Debounced auto-save (1-2s) | 2020+ | Users don't lose work |

**Deprecated/outdated:**
- `react-markdown` className prop: Removed in v10. Wrap in div with class instead.
- `transformImageUri`/`transformLinkUri`: Replaced by unified `urlTransform` in v9.
- `marked`, `markdown-it` for React apps: Return HTML strings, require dangerouslySetInnerHTML.
- Manual conflict resolution UIs: Simple "keep yours/theirs" is sufficient for v1.

## Open Questions

Things that couldn't be fully resolved:

1. **Note history/versioning**
   - What we know: Could store revisions in separate table
   - What's unclear: Is this needed for v1? How many versions to keep?
   - Recommendation: Defer to v0.5.0+. Version column for conflict detection is sufficient.

2. **Presence indicators on notes**
   - What we know: Could show who else is viewing the note
   - What's unclear: Adds UI complexity. Worth it for v1?
   - Recommendation: Defer to v0.5.0+. Focus on core editing flow.

3. **Note search**
   - What we know: Could integrate with existing PostgreSQL FTS
   - What's unclear: Should notes appear in message search or separate?
   - Recommendation: Defer to v0.5.0+. Notes are discoverable via channel header.

4. **Personal notes access from sidebar**
   - What we know: Need UI to access personal scratchpad
   - What's unclear: Separate sidebar item? Under profile? Floating button?
   - Recommendation: Add to profile section in sidebar for v1.

## Sources

### Primary (HIGH confidence)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Official documentation, changelog
- [react-markdown changelog](https://github.com/remarkjs/react-markdown/blob/main/changelog.md) - v9.0.2 React 19 types fix, v10 API changes
- [remark-gfm GitHub](https://github.com/remarkjs/remark-gfm) - GFM plugin documentation
- Project existing patterns - socket-events.ts, channel-header.tsx, Drizzle schema files
- [STACK-v0.4.0.md](/.planning/research/STACK-v0.4.0.md) - Project technology decisions
- [FEATURES-v0.4.0.md](/.planning/research/FEATURES-v0.4.0.md) - Feature requirements and anti-patterns

### Secondary (MEDIUM confidence)
- [Strapi: React Markdown Complete Guide 2025](https://strapi.io/blog/react-markdown-complete-guide-security-styling) - Security and styling patterns
- [Optimistic Concurrency Control Guide](https://www.shadecoder.com/topics/optimistic-concurrency-control-a-practical-guide-for-2025) - Conflict detection patterns
- [Vlad Mihalcea: Optimistic vs Pessimistic Locking](https://vladmihalcea.com/optimistic-vs-pessimistic-locking/) - Database locking strategies
- [remarkjs react-markdown docs](https://remarkjs.github.io/react-markdown/) - Official demo and examples

### Tertiary (LOW confidence)
- [@uiw/react-md-editor](https://github.com/uiwjs/react-md-editor) - Alternative editor (not recommended, adds complexity)
- [Dev.to: React Markdown Editor](https://dev.to/mohammadtaseenkhan/react-markdown-editor-with-real-time-preview-5h8n) - General patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-markdown is well-documented, React 19 compatible confirmed in v9.0.2
- Architecture: HIGH - Edit/preview toggle is proven pattern, optimistic locking is standard
- Pitfalls: HIGH - Based on existing codebase patterns and OWASP guidelines
- Database schema: HIGH - Follows existing Drizzle ORM patterns in project

**Research date:** 2026-01-20
**Valid until:** 90 days (stable patterns, minimal external dependencies)
