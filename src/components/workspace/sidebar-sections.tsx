"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageSquare, Search, StickyNote, Clock, Bell, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateSectionOrder } from "@/lib/actions/sidebar-preferences";
import { DEFAULT_SECTION_ORDER } from "@/lib/types/sidebar";

/**
 * Configuration for each sidebar section.
 */
const SECTION_CONFIG: Record<string, { icon: React.ElementType; label: string; path: (slug: string) => string }> = {
  threads: { icon: MessageSquare, label: "Threads", path: (s) => `/${s}/threads` },
  search: { icon: Search, label: "Search", path: (s) => `/${s}/search` },
  notes: { icon: StickyNote, label: "My Notes", path: (s) => `/${s}/notes` },
  scheduled: { icon: Clock, label: "Scheduled", path: (s) => `/${s}/scheduled` },
  reminders: { icon: Bell, label: "Reminders", path: (s) => `/${s}/reminders` },
  saved: { icon: Bookmark, label: "Saved", path: (s) => `/${s}/saved` },
};

/**
 * Sortable sidebar section item.
 */
function SortableSection({
  sectionId,
  workspaceSlug,
  extraContent,
}: {
  sectionId: string;
  workspaceSlug: string;
  extraContent?: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionId });

  const config = SECTION_CONFIG[sectionId];
  if (!config) return null;

  const Icon = config.icon;
  const href = config.path(workspaceSlug);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group flex items-center", isDragging && "opacity-50")}
    >
      <button
        className="opacity-0 group-hover:opacity-100 p-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <Link
        href={href}
        className={cn(
          "flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
          pathname === href && "bg-accent"
        )}
      >
        <Icon className="h-4 w-4" />
        {config.label}
        {extraContent}
      </Link>
    </div>
  );
}

/**
 * Non-sortable section item for drag overlay.
 */
function SectionOverlay({ sectionId }: { sectionId: string }) {
  const config = SECTION_CONFIG[sectionId];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md bg-accent shadow-lg">
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <Icon className="h-4 w-4" />
      {config.label}
    </div>
  );
}

interface SidebarSectionsProps {
  workspaceSlug: string;
  organizationId: string;
  savedSectionOrder?: string[];
  hiddenSections?: string[];
  reminderBadge?: React.ReactNode;
}

/**
 * Sidebar sections component with drag-and-drop reordering.
 * SIDE-06: Users can customize which sections appear and in what order.
 */
export function SidebarSections({
  workspaceSlug,
  organizationId,
  savedSectionOrder,
  hiddenSections = [],
  reminderBadge,
}: SidebarSectionsProps) {
  // Initialize with saved order or default, filtering out hidden sections
  const [localOrder, setLocalOrder] = useState<string[]>(() => {
    const order = savedSectionOrder?.length ? savedSectionOrder : DEFAULT_SECTION_ORDER;
    return order.filter((id) => !hiddenSections.includes(id));
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const oldIndex = localOrder.indexOf(active.id as string);
      const newIndex = localOrder.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistic update
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);

      // Persist to server
      try {
        await updateSectionOrder(organizationId, newOrder);
      } catch (error) {
        // Revert on error
        setLocalOrder(localOrder);
        console.error("Failed to save section order:", error);
      }
    },
    [localOrder, organizationId]
  );

  return (
    <DndContext
      id="sidebar-sections-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
        <div className="px-3 py-1">
          {localOrder.map((sectionId) => (
            <SortableSection
              key={sectionId}
              sectionId={sectionId}
              workspaceSlug={workspaceSlug}
              extraContent={sectionId === "reminders" ? reminderBadge : undefined}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId && <SectionOverlay sectionId={activeId} />}
      </DragOverlay>
    </DndContext>
  );
}
