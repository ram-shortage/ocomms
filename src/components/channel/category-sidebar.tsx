"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronDown, Hash, Lock, GripVertical, FolderPlus } from "lucide-react";
import { useUnreadCounts } from "@/lib/hooks/use-unread";
import {
  assignChannelToCategory,
  toggleCategoryCollapse,
  reorderChannelsInCategory,
} from "@/lib/actions/channel-category";
import { cn } from "@/lib/utils";
import { CreateCategoryDialog } from "./create-category-dialog";
import { Button } from "@/components/ui/button";

interface Channel {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
  categoryId: string | null;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  channelCount: number;
}

interface CategorySidebarProps {
  categories: Category[];
  channels: Channel[];
  collapseStates: Record<string, boolean>;
  workspaceSlug: string;
  organizationId: string;
  isAdmin: boolean;
}

// Sortable channel item component
function SortableChannelItem({
  channel,
  workspaceSlug,
  unreadCount,
  isAdmin,
  isDragging,
}: {
  channel: Channel;
  workspaceSlug: string;
  unreadCount: number;
  isAdmin: boolean;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: channel.id, disabled: !isAdmin });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasUnreads = unreadCount > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center",
        isSortableDragging && "opacity-50",
        isDragging && "opacity-50"
      )}
    >
      {isAdmin && (
        <button
          className="opacity-0 group-hover:opacity-100 p-1 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
      <Link
        href={`/${workspaceSlug}/channels/${channel.slug}`}
        className={cn(
          "flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors",
          !isAdmin && "pl-6"
        )}
      >
        {channel.isPrivate ? (
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className={cn("truncate", hasUnreads && "font-semibold")}>
          {channel.name}
        </span>
        {hasUnreads && (
          <span className="ml-auto bg-blue-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shrink-0">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </div>
  );
}

// Channel item for drag overlay (non-sortable)
function ChannelItemOverlay({ channel }: { channel: Channel }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md bg-accent shadow-lg">
      {channel.isPrivate ? (
        <Lock className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Hash className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="truncate">{channel.name}</span>
    </div>
  );
}

// Category section component with droppable support
function CategorySection({
  category,
  channels,
  isCollapsed,
  onToggleCollapse,
  workspaceSlug,
  channelUnreads,
  isAdmin,
  activeId,
}: {
  category: Category;
  channels: Channel[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  workspaceSlug: string;
  channelUnreads: Record<string, number>;
  isAdmin: boolean;
  activeId: string | null;
}) {
  // Make the category header a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${category.id}`,
    data: { type: "category", categoryId: category.id },
  });

  // Calculate total unread for collapsed category badge
  const totalUnread = useMemo(() => {
    return channels.reduce((sum, ch) => sum + (channelUnreads[ch.id] ?? 0), 0);
  }, [channels, channelUnreads]);

  // Empty categories: show for admins (so they can drag channels in), hide for others
  if (channels.length === 0 && !isAdmin) {
    return null;
  }

  const sortedChannels = [...channels].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mb-2" ref={setNodeRef}>
      {/* Category header */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          "w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded",
          isOver && "bg-accent"
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span className="truncate">{category.name}</span>
        {/* Show unread badge when collapsed */}
        {isCollapsed && totalUnread > 0 && (
          <span className="ml-auto bg-blue-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Channels in category */}
      {!isCollapsed && (
        <SortableContext
          items={sortedChannels.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0.5">
            {sortedChannels.map((channel) => (
              <SortableChannelItem
                key={channel.id}
                channel={channel}
                workspaceSlug={workspaceSlug}
                unreadCount={channelUnreads[channel.id] ?? 0}
                isAdmin={isAdmin}
                isDragging={activeId === channel.id}
              />
            ))}
            {/* Empty drop zone when category has no channels */}
            {channels.length === 0 && isAdmin && (
              <div className="px-6 py-2 text-xs text-muted-foreground italic">
                Drag channels here
              </div>
            )}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

export function CategorySidebar({
  categories,
  channels,
  collapseStates: initialCollapseStates,
  workspaceSlug,
  organizationId,
  isAdmin,
}: CategorySidebarProps) {
  const [collapseStates, setCollapseStates] = useState(initialCollapseStates);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localChannels, setLocalChannels] = useState(channels);

  // Sync localChannels when channels prop changes (e.g., after category creation)
  useEffect(() => {
    setLocalChannels(channels);
  }, [channels]);

  // Get all channel IDs for unread counts
  const channelIds = useMemo(() => localChannels.map((c) => c.id), [localChannels]);
  const { channelUnreads } = useUnreadCounts(channelIds);

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

  // Group channels by category
  const channelsByCategory = useMemo(() => {
    const grouped: Record<string, Channel[]> = { uncategorized: [] };
    categories.forEach((cat) => {
      grouped[cat.id] = [];
    });
    localChannels.forEach((channel) => {
      if (channel.categoryId && grouped[channel.categoryId]) {
        grouped[channel.categoryId].push(channel);
      } else {
        grouped.uncategorized.push(channel);
      }
    });
    return grouped;
  }, [localChannels, categories]);

  // Handle collapse toggle
  const handleToggleCollapse = useCallback(
    async (categoryId: string) => {
      const newState = !collapseStates[categoryId];
      setCollapseStates((prev) => ({ ...prev, [categoryId]: newState }));

      // Persist to server (no await - fire and forget)
      toggleCategoryCollapse(categoryId, newState).catch(console.error);
    },
    [collapseStates]
  );

  // Find which category a position is over
  const findCategoryAtPosition = useCallback(
    (overId: string): string | null => {
      // Check if over a channel
      const overChannel = localChannels.find((c) => c.id === overId);
      if (overChannel) {
        return overChannel.categoryId;
      }
      // Check if over a category directly
      if (categories.find((c) => c.id === overId)) {
        return overId;
      }
      return null;
    },
    [localChannels, categories]
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const activeChannel = localChannels.find((c) => c.id === active.id);
      if (!activeChannel) return;

      // Determine target category - check if dropped on category header or channel
      let targetCategoryId: string | null = null;

      // Check if dropped on a category droppable (id format: "category-{id}")
      const overId = over.id as string;
      if (overId.startsWith("category-")) {
        targetCategoryId = overId.replace("category-", "");
      } else {
        // Dropped on a channel - use that channel's category
        const overChannel = localChannels.find((c) => c.id === overId);
        targetCategoryId = overChannel?.categoryId ?? null;
      }

      // If moving to a different category
      if (activeChannel.categoryId !== targetCategoryId) {
        // Optimistic update
        setLocalChannels((prev) =>
          prev.map((ch) =>
            ch.id === activeChannel.id
              ? { ...ch, categoryId: targetCategoryId }
              : ch
          )
        );

        // Persist to server
        try {
          await assignChannelToCategory(activeChannel.id, targetCategoryId);
        } catch (error) {
          // Revert on error
          setLocalChannels((prev) =>
            prev.map((ch) =>
              ch.id === activeChannel.id
                ? { ...ch, categoryId: activeChannel.categoryId }
                : ch
            )
          );
          console.error("Failed to move channel:", error);
        }
      } else {
        // Reorder within same category
        const categoryChannels = localChannels.filter(
          (c) => c.categoryId === targetCategoryId
        );
        const oldIndex = categoryChannels.findIndex((c) => c.id === active.id);
        const newIndex = categoryChannels.findIndex((c) => c.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Reorder array
          const newOrder = [...categoryChannels];
          const [removed] = newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, removed);

          // Update sort orders
          const updatedChannels = newOrder.map((ch, idx) => ({
            ...ch,
            sortOrder: idx,
          }));

          // Optimistic update
          setLocalChannels((prev) => {
            const otherChannels = prev.filter(
              (c) => c.categoryId !== targetCategoryId
            );
            return [...otherChannels, ...updatedChannels];
          });

          // Persist to server
          try {
            await reorderChannelsInCategory(
              targetCategoryId,
              updatedChannels.map((c) => c.id)
            );
          } catch (error) {
            console.error("Failed to reorder channels:", error);
            // Revert
            setLocalChannels(channels);
          }
        }
      }
    },
    [localChannels, channels]
  );

  // Get active channel for overlay
  const activeChannel = activeId
    ? localChannels.find((c) => c.id === activeId)
    : null;

  // Sort categories by sortOrder
  const sortedCategories = [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <DndContext
      id="category-sidebar-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-1">
        {/* Categories with channels */}
        {sortedCategories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            channels={channelsByCategory[category.id] || []}
            isCollapsed={collapseStates[category.id] ?? false}
            onToggleCollapse={() => handleToggleCollapse(category.id)}
            workspaceSlug={workspaceSlug}
            channelUnreads={channelUnreads}
            isAdmin={isAdmin}
            activeId={activeId}
          />
        ))}

        {/* Uncategorized channels section - always at bottom */}
        {channelsByCategory.uncategorized.length > 0 && (
          <div className="mb-2">
            <SortableContext
              items={channelsByCategory.uncategorized.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {channelsByCategory.uncategorized
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((channel) => (
                    <SortableChannelItem
                      key={channel.id}
                      channel={channel}
                      workspaceSlug={workspaceSlug}
                      unreadCount={channelUnreads[channel.id] ?? 0}
                      isAdmin={isAdmin}
                      isDragging={activeId === channel.id}
                    />
                  ))}
              </div>
            </SortableContext>
          </div>
        )}

        {/* Create category button for admins */}
        {isAdmin && (
          <div className="px-2 pt-2">
            <CreateCategoryDialog
              organizationId={organizationId}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                >
                  <FolderPlus className="h-3 w-3 mr-2" />
                  New Category
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeChannel && <ChannelItemOverlay channel={activeChannel} />}
      </DragOverlay>
    </DndContext>
  );
}
