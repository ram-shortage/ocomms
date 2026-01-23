# Phase 34: Sidebar Reorganization - Research

**Researched:** 2026-01-23
**Domain:** React drag-and-drop, user preferences persistence, real-time sync
**Confidence:** HIGH

## Summary

This phase implements comprehensive sidebar customization with drag-and-drop reordering for categories, channels, DMs, and sidebar sections. The research confirms the existing `@dnd-kit` library already in the codebase is the correct tool for this job, with established patterns in the existing `CategorySidebar` component providing a solid foundation to extend.

The key technical challenge is the hybrid persistence model: localStorage for instant responsiveness combined with server-side storage for cross-device sync. The project already uses this pattern with Dexie (IndexedDB) for message caching, and the same architectural approach applies here. The decision to use "last write wins" conflict resolution simplifies implementation significantly compared to CRDT-based approaches.

The existing `category-sidebar.tsx` already implements channel drag-and-drop within and between categories. This phase extends that foundation to include: (1) category reordering, (2) DM reordering, (3) sidebar section reordering, and (4) moving the "New Category" button to Settings.

**Primary recommendation:** Extend the existing `@dnd-kit` implementation with a new `userSidebarPreferences` database table for server persistence, paired with a custom React hook that manages localStorage + server sync with optimistic updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | ^6.3.1 | Drag-and-drop context, sensors, events | Already in project; modern, accessible, performant |
| @dnd-kit/sortable | ^10.0.0 | Sortable list primitives | Already in project; designed for list reordering |
| @dnd-kit/utilities | ^3.2.2 | CSS transform helpers | Already in project; simplifies transform styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 | Database ORM | Server-side preference storage |
| socket.io-client | ^4.8.3 | Real-time sync | Cross-device preference sync events |
| localStorage (native) | - | Instant client persistence | Immediate UI responsiveness |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage | Dexie/IndexedDB | Dexie is overkill for small JSON preference objects; localStorage is simpler and sufficient |
| Last-write-wins | CRDT | CRDTs add significant complexity; last-write-wins acceptable for non-critical preference data |
| Socket.io sync | Polling | Socket.io already in use; real-time sync improves UX over polling |

**Installation:**
```bash
# No new packages needed - all dependencies already present
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/schema/
│   └── sidebar-preferences.ts    # New: userSidebarPreferences table
├── lib/
│   ├── actions/
│   │   └── sidebar-preferences.ts # Server actions for CRUD
│   └── hooks/
│       └── use-sidebar-preferences.ts # localStorage + server sync hook
├── components/
│   ├── workspace/
│   │   └── workspace-sidebar.tsx  # Update: use preferences hook
│   ├── channel/
│   │   ├── category-sidebar.tsx   # Update: add category reordering
│   │   └── sortable-category.tsx  # New: draggable category wrapper
│   ├── dm/
│   │   ├── dm-list-client.tsx     # Update: add DM reordering
│   │   └── sortable-dm-item.tsx   # New: draggable DM wrapper
│   └── sidebar/
│       └── sortable-section.tsx   # New: draggable section wrapper
└── app/(workspace)/[workspaceSlug]/settings/
    └── sidebar/
        └── page.tsx               # New: Sidebar settings page
```

### Pattern 1: Multiple SortableContext with Single DndContext
**What:** One DndContext wrapping multiple SortableContext providers for different draggable groups
**When to use:** When you have distinct sortable lists that should not intermix (categories vs DMs vs sections)
**Example:**
```typescript
// Source: https://docs.dndkit.com/presets/sortable
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  {/* Categories are sortable among themselves */}
  <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
    {categories.map((cat) => (
      <SortableCategory key={cat.id} category={cat}>
        {/* Channels within each category are sortable */}
        <SortableContext items={channelIds} strategy={verticalListSortingStrategy}>
          {channels.map((ch) => <SortableChannel key={ch.id} channel={ch} />)}
        </SortableContext>
      </SortableCategory>
    ))}
  </SortableContext>

  {/* DMs are sortable separately */}
  <SortableContext items={dmIds} strategy={verticalListSortingStrategy}>
    {dms.map((dm) => <SortableDM key={dm.id} dm={dm} />)}
  </SortableContext>

  {/* Sections are sortable separately */}
  <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
    {sections.map((sec) => <SortableSection key={sec.id} section={sec} />)}
  </SortableContext>

  <DragOverlay>
    {activeItem && <DragPreview item={activeItem} />}
  </DragOverlay>
</DndContext>
```

### Pattern 2: Optimistic Update with localStorage + Server Sync
**What:** Update localStorage immediately, then sync to server, rollback on failure
**When to use:** All sidebar preference changes
**Example:**
```typescript
// Source: Project pattern from use-unread.ts + optimistic update best practices
function useSidebarPreferences(workspaceId: string) {
  const [preferences, setPreferences] = useState<SidebarPreferences>(() => {
    // Load from localStorage on mount
    const cached = localStorage.getItem(`sidebar-prefs-${workspaceId}`);
    return cached ? JSON.parse(cached) : DEFAULT_PREFERENCES;
  });

  const updatePreferences = useCallback(async (updates: Partial<SidebarPreferences>) => {
    const previous = preferences;
    const updated = { ...preferences, ...updates, updatedAt: new Date().toISOString() };

    // Optimistic update to localStorage and state
    setPreferences(updated);
    localStorage.setItem(`sidebar-prefs-${workspaceId}`, JSON.stringify(updated));

    try {
      // Sync to server
      await saveSidebarPreferences(workspaceId, updated);
    } catch (error) {
      // Rollback on failure
      setPreferences(previous);
      localStorage.setItem(`sidebar-prefs-${workspaceId}`, JSON.stringify(previous));
      toast.error("Failed to save sidebar preferences");
    }
  }, [preferences, workspaceId]);

  return { preferences, updatePreferences };
}
```

### Pattern 3: Drag Handle Visibility on Hover
**What:** Show grip icon only when mouse hovers over item
**When to use:** Desktop drag interaction as specified in CONTEXT.md
**Example:**
```typescript
// Source: Existing pattern in category-sidebar.tsx
function SortableItem({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });

  return (
    <div ref={setNodeRef} className="group flex items-center">
      {/* Drag handle - hidden by default, visible on hover */}
      <button
        className="opacity-0 group-hover:opacity-100 p-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <span>{item.name}</span>
    </div>
  );
}
```

### Pattern 4: Mobile Edit Mode
**What:** Dedicated reorder mode triggered from menu, not long-press
**When to use:** Mobile touch interaction as specified in CONTEXT.md
**Example:**
```typescript
// Source: CONTEXT.md decision + dnd-kit mobile patterns
function MobileSidebar({ items }: { items: Item[] }) {
  const [editMode, setEditMode] = useState(false);

  // Touch sensor with appropriate delay for edit mode
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 100, // Short delay since we're in explicit edit mode
      tolerance: 5,
    },
  });

  return (
    <>
      <Button onClick={() => setEditMode(!editMode)}>
        {editMode ? "Done" : "Reorder"}
      </Button>

      <DndContext sensors={useSensors(touchSensor)} disabled={!editMode}>
        <SortableContext items={items.map(i => i.id)}>
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              showHandle={editMode} // Always show handles in edit mode
            />
          ))}
        </SortableContext>
      </DndContext>
    </>
  );
}
```

### Anti-Patterns to Avoid
- **Nested DndContext:** Do not nest DndContext providers; events stop at the innermost context. Use a single DndContext with multiple SortableContext instead.
- **Rendering sortable components in DragOverlay:** Never render the same component that calls useSortable inside DragOverlay; create a separate presentational component.
- **Mutating items array order without updating SortableContext:** The items prop must always match the rendered order.
- **Using PointerSensor alone on mobile:** PointerSensor can interfere with scrolling; use TouchSensor with appropriate delay for touch devices.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable list reordering | Manual drag event handling | @dnd-kit/sortable | Handles keyboard nav, screen readers, touch, edge cases |
| Array reorder logic | Manual splice/insert | arrayMove from @dnd-kit/sortable | Battle-tested, handles edge cases |
| Drag preview/ghost | Manual clone + position | DragOverlay component | Handles viewport-relative positioning, z-index |
| Touch vs mouse detection | Manual event sniffing | PointerSensor + TouchSensor | Handles activation constraints, scroll prevention |
| Collision detection | Manual hit testing | closestCenter algorithm | Optimized for sortable lists |
| Keyboard navigation | Manual keydown handlers | KeyboardSensor | Full accessibility support built-in |

**Key insight:** Drag-and-drop has countless edge cases (scroll containers, touch vs mouse, accessibility, animations) that libraries like dnd-kit have solved over years. Custom solutions inevitably miss important cases.

## Common Pitfalls

### Pitfall 1: Items Array Order Mismatch
**What goes wrong:** SortableContext items prop doesn't match rendered element order, causing visual glitches
**Why it happens:** State update doesn't sort items before passing to SortableContext
**How to avoid:** Always sort items array before passing to SortableContext and rendering
**Warning signs:** Items jump to wrong positions during drag, visual flickering

### Pitfall 2: Stale Closure in Event Handlers
**What goes wrong:** onDragEnd handler uses stale state values
**Why it happens:** Handler captures state at creation time, not execution time
**How to avoid:** Use useCallback with proper dependencies, or access current state via refs
**Warning signs:** Dropped items go to wrong position, state doesn't update correctly

### Pitfall 3: Touch Scrolling Conflicts
**What goes wrong:** Can't scroll sidebar on mobile because touch initiates drag
**Why it happens:** PointerSensor captures touch events that should scroll
**How to avoid:** Use TouchSensor with delay constraint, use drag handles, set touch-action CSS
**Warning signs:** Users report inability to scroll on mobile

### Pitfall 4: localStorage Race Conditions
**What goes wrong:** Multiple tabs save conflicting preferences
**Why it happens:** No coordination between tabs reading/writing localStorage
**How to avoid:** Use storage event listener to sync across tabs, or accept last-write-wins
**Warning signs:** Preferences reset when switching tabs

### Pitfall 5: Server Sync Without Optimistic Rollback
**What goes wrong:** UI shows saved state but server failed, user confused
**Why it happens:** Optimistic update without proper error handling
**How to avoid:** Store previous state before update, rollback on server error, show toast
**Warning signs:** Users report preferences not persisting across devices

### Pitfall 6: DragOverlay ID Collision
**What goes wrong:** React key/ID warnings, drag behavior breaks
**Why it happens:** Rendering same component with useSortable hook inside DragOverlay
**How to avoid:** Create separate presentational component for DragOverlay without hooks
**Warning signs:** Console warnings about duplicate keys, drag doesn't work properly

## Code Examples

Verified patterns from official sources:

### Sensor Configuration for Desktop + Mobile
```typescript
// Source: https://docs.dndkit.com/api-documentation/sensors
import {
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

function useDndSensors(isEditMode: boolean) {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags on click
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: isEditMode
        ? { delay: 100, tolerance: 5 }  // Quick in edit mode
        : { delay: 250, tolerance: 5 }, // Longer delay normally
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
```

### Database Schema for User Sidebar Preferences
```typescript
// Source: Project pattern from existing schema files
import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { users, organizations } from "./auth";

// Sidebar preferences stored as JSON for flexibility
export interface SidebarPreferencesData {
  categoryOrder: string[];           // Category IDs in order
  dmOrder: string[];                 // Conversation IDs in order
  sectionOrder: string[];            // Section keys: "notes", "scheduled", "reminders", "saved"
  hiddenSections: string[];          // Section keys that are hidden
  collapsedSections: string[];       // Section keys that are collapsed
  updatedAt: string;                 // ISO timestamp for conflict resolution
}

export const userSidebarPreferences = pgTable("user_sidebar_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").notNull().$type<SidebarPreferencesData>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Socket Event for Cross-Device Sync
```typescript
// Source: Project pattern from socket-events.ts
// Add to ServerToClientEvents:
"sidebar:preferencesUpdated": (data: {
  workspaceId: string;
  preferences: SidebarPreferencesData;
}) => void;

// Add to ClientToServerEvents:
"sidebar:syncPreferences": (
  data: { workspaceId: string; preferences: SidebarPreferencesData },
  callback: (response: { success: boolean }) => void
) => void;
```

### Sidebar Settings Page Structure
```typescript
// Source: Project pattern from settings/page.tsx
export default async function SidebarSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  // ... auth check ...

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Sidebar Settings</h1>

      {/* Category Management */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Categories</h2>
        <CategoryManager organizationId={org.id} />
      </section>

      {/* Section Visibility */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sidebar Sections</h2>
        <SectionVisibilityManager workspaceSlug={workspaceSlug} />
      </section>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit | 2023+ | react-beautiful-dnd deprecated; dnd-kit is the modern choice |
| Global state for drag | Context + local state | Current | More predictable, better performance |
| Sync-first persistence | Offline-first with sync | 2024+ | Better UX, works offline |
| Admin-only reordering | Per-user preferences | This phase | Categories become personal organization |

**Deprecated/outdated:**
- react-beautiful-dnd: Officially deprecated, no longer maintained
- react-dnd: Still works but dnd-kit is generally preferred for sortable lists
- Server-only preference storage: Adds latency; localStorage-first is standard

## Open Questions

Things that couldn't be fully resolved:

1. **Animation Timing Defaults**
   - What we know: dnd-kit defaults to 250ms ease; project should be consistent
   - What's unclear: Exact values that feel best for this sidebar
   - Recommendation: Start with defaults (250ms, ease), tune based on testing

2. **Category Personal vs Workspace Scope**
   - What we know: CONTEXT.md says categories are per-user personal organization
   - What's unclear: How channels map when category structure differs between users
   - Recommendation: Store user's category assignments separately from workspace channels

3. **Hidden Section Badge Indicator Location**
   - What we know: CONTEXT.md says "badge indicator on Settings/menu" for hidden sections with unread
   - What's unclear: Exact UI location and design of this indicator
   - Recommendation: Add small dot indicator on Settings link when any hidden section has unreads

## Sources

### Primary (HIGH confidence)
- @dnd-kit official documentation - https://docs.dndkit.com
- @dnd-kit/sortable preset docs - https://docs.dndkit.com/presets/sortable
- Collision detection algorithms - https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms
- Touch sensor configuration - https://docs.dndkit.com/api-documentation/sensors/touch
- Existing project code: `category-sidebar.tsx`, `socket-events.ts`, `use-unread.ts`

### Secondary (MEDIUM confidence)
- GitHub Discussion: Moving data between SortableContext - https://github.com/clauderic/dnd-kit/discussions/1111
- dnd-kit nested sortable patterns - https://dev.to/fupeng_wang/react-dnd-kit-implement-tree-list-drag-and-drop-sortable-225l

### Tertiary (LOW confidence)
- Community tutorials on Kanban implementation (verified patterns match official docs)
- React optimistic update patterns (general best practices)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already using dnd-kit in project, well-documented
- Architecture: HIGH - Patterns verified against existing codebase and official docs
- Pitfalls: HIGH - Documented in official docs and confirmed in codebase
- Persistence pattern: MEDIUM - Following established project patterns, some details to finalize

**Research date:** 2026-01-23
**Valid until:** 60 days (dnd-kit is stable, patterns well-established)
