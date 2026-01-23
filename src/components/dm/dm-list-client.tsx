"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
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
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableDMListItem, DMListItemOverlay } from "./dm-list-item";
import { updateDmOrder } from "@/lib/actions/sidebar-preferences";

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  lastMessageAt: Date | null;
}

interface DMListClientProps {
  conversations: Conversation[];
  workspaceSlug: string;
  organizationId: string;
  savedDmOrder?: string[];
}

export function DMListClient({
  conversations,
  workspaceSlug,
  organizationId,
  savedDmOrder,
}: DMListClientProps) {
  // Apply saved order or use default
  const [localConversations, setLocalConversations] = useState(() => {
    if (savedDmOrder && savedDmOrder.length > 0) {
      const orderMap = new Map(savedDmOrder.map((id, idx) => [id, idx]));
      return [...conversations].sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
    }
    return conversations;
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync localConversations when conversations prop changes (new DMs, etc.)
  useEffect(() => {
    if (savedDmOrder && savedDmOrder.length > 0) {
      const orderMap = new Map(savedDmOrder.map((id, idx) => [id, idx]));
      // New conversations not in saved order go to the end
      setLocalConversations(
        [...conversations].sort((a, b) => {
          const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
          const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder;
        })
      );
    } else {
      setLocalConversations(conversations);
    }
  }, [conversations, savedDmOrder]);

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

      const oldIndex = localConversations.findIndex((c) => c.id === active.id);
      const newIndex = localConversations.findIndex((c) => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(localConversations, oldIndex, newIndex);
        setLocalConversations(newOrder);

        // Persist to server
        try {
          await updateDmOrder(organizationId, newOrder.map((c) => c.id));
        } catch (error) {
          // Revert on error
          console.error("Failed to save DM order:", error);
          setLocalConversations(localConversations);
        }
      }
    },
    [localConversations, organizationId]
  );

  // Get active conversation for overlay
  const activeConversation = activeId
    ? localConversations.find((c) => c.id === activeId)
    : null;

  if (localConversations.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        No direct messages yet
      </div>
    );
  }

  return (
    <DndContext
      id="dm-list-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localConversations.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {localConversations.map((conversation) => (
            <SortableDMListItem
              key={conversation.id}
              conversationId={conversation.id}
              workspaceSlug={workspaceSlug}
              isGroup={false}
              displayName={
                conversation.otherUser.name || conversation.otherUser.email
              }
              otherUserId={conversation.otherUser.id}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeConversation && (
          <DMListItemOverlay
            displayName={
              activeConversation.otherUser.name ||
              activeConversation.otherUser.email
            }
            isGroup={false}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
