"use client";

import { useState, useCallback, useMemo, ReactNode } from "react";
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
import { ChevronDown, GripVertical, Hash, MessageSquare, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateMainSectionOrder, updateCollapsedSections } from "@/lib/actions/sidebar-preferences";
import { DEFAULT_MAIN_SECTION_ORDER } from "@/lib/types/sidebar";

/**
 * Main section IDs for the sidebar.
 */
export type MainSectionId = "channels" | "dms" | "archived";

/**
 * Configuration for each main section.
 */
const SECTION_CONFIG: Record<MainSectionId, { icon: React.ElementType; label: string }> = {
  channels: { icon: Hash, label: "Channels" },
  dms: { icon: MessageSquare, label: "Direct Messages" },
  archived: { icon: Archive, label: "Archived" },
};

interface SortableMainSectionProps {
  sectionId: MainSectionId;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: ReactNode;
  actionButton?: ReactNode;
  /** Whether this section has any content to show */
  hasContent?: boolean;
}

/**
 * Sortable main section with collapse toggle.
 */
function SortableMainSection({
  sectionId,
  isCollapsed,
  onToggleCollapse,
  children,
  actionButton,
  hasContent = true,
}: SortableMainSectionProps) {
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

  // Don't render archived section if it has no content
  if (sectionId === "archived" && !hasContent) {
    return null;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("mt-2", isDragging && "opacity-50")}
    >
      {/* Section header */}
      <div className="group px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Drag handle */}
          <button
            className="opacity-0 group-hover:opacity-100 p-0.5 cursor-grab active:cursor-grabbing -ml-1"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          {/* Collapse toggle and label */}
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                isCollapsed && "-rotate-90"
              )}
            />
            <span>{config.label}</span>
          </button>
        </div>
        {/* Action button (e.g., create channel, start DM) */}
        {actionButton && !isCollapsed && actionButton}
      </div>

      {/* Section content */}
      {!isCollapsed && children}
    </div>
  );
}

/**
 * Overlay component for drag preview.
 */
function SectionOverlay({ sectionId }: { sectionId: MainSectionId }) {
  const config = SECTION_CONFIG[sectionId];
  if (!config) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-accent shadow-lg rounded-md">
      <GripVertical className="h-3 w-3" />
      <ChevronDown className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}

interface MainSectionsProps {
  organizationId: string;
  savedMainSectionOrder?: string[];
  collapsedSections?: string[];
  /** Render functions for each section's content */
  renderChannels: (isCollapsed: boolean) => ReactNode;
  renderDMs: (isCollapsed: boolean) => ReactNode;
  renderArchived: (isCollapsed: boolean) => ReactNode;
  /** Action buttons for section headers */
  channelsActionButton?: ReactNode;
  dmsActionButton?: ReactNode;
  /** Whether archived section has content */
  hasArchivedChannels?: boolean;
}

/**
 * Main sections component with drag-and-drop reordering and collapse toggles.
 * Wraps Channels, Direct Messages, and Archived sections.
 */
export function MainSections({
  organizationId,
  savedMainSectionOrder,
  collapsedSections: savedCollapsedSections = [],
  renderChannels,
  renderDMs,
  renderArchived,
  channelsActionButton,
  dmsActionButton,
  hasArchivedChannels = false,
}: MainSectionsProps) {
  // Initialize order from saved preferences or default
  const [localOrder, setLocalOrder] = useState<MainSectionId[]>(() => {
    if (savedMainSectionOrder && savedMainSectionOrder.length > 0) {
      // Filter to only valid section IDs and ensure all sections are present
      const validIds = savedMainSectionOrder.filter(
        (id): id is MainSectionId => id === "channels" || id === "dms" || id === "archived"
      );
      // Add any missing sections at the end
      const missingIds = (DEFAULT_MAIN_SECTION_ORDER as MainSectionId[]).filter(
        (id) => !validIds.includes(id)
      );
      return [...validIds, ...missingIds];
    }
    return DEFAULT_MAIN_SECTION_ORDER as MainSectionId[];
  });

  // Initialize collapsed state from saved preferences
  const [collapsedState, setCollapsedState] = useState<Record<MainSectionId, boolean>>(() => ({
    channels: savedCollapsedSections.includes("channels"),
    dms: savedCollapsedSections.includes("dms"),
    archived: savedCollapsedSections.includes("archived"),
  }));

  const [activeId, setActiveId] = useState<MainSectionId | null>(null);

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

  // Handle collapse toggle
  const handleToggleCollapse = useCallback(
    async (sectionId: MainSectionId) => {
      const newCollapsedState = {
        ...collapsedState,
        [sectionId]: !collapsedState[sectionId],
      };
      setCollapsedState(newCollapsedState);

      // Build array of collapsed section IDs for persistence
      const collapsedIds = (Object.keys(newCollapsedState) as MainSectionId[]).filter(
        (id) => newCollapsedState[id]
      );

      // Persist to server (fire and forget)
      updateCollapsedSections(organizationId, collapsedIds).catch(console.error);
    },
    [collapsedState, organizationId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as MainSectionId);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const oldIndex = localOrder.indexOf(active.id as MainSectionId);
      const newIndex = localOrder.indexOf(over.id as MainSectionId);

      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistic update
      const newOrder = arrayMove(localOrder, oldIndex, newIndex);
      setLocalOrder(newOrder);

      // Persist to server
      try {
        await updateMainSectionOrder(organizationId, newOrder);
      } catch (error) {
        // Revert on error
        setLocalOrder(localOrder);
        console.error("Failed to save main section order:", error);
      }
    },
    [localOrder, organizationId]
  );

  // Render function map
  const renderSection = useCallback(
    (sectionId: MainSectionId) => {
      switch (sectionId) {
        case "channels":
          return (
            <SortableMainSection
              key={sectionId}
              sectionId={sectionId}
              isCollapsed={collapsedState.channels}
              onToggleCollapse={() => handleToggleCollapse("channels")}
              actionButton={channelsActionButton}
            >
              {renderChannels(collapsedState.channels)}
            </SortableMainSection>
          );
        case "dms":
          return (
            <SortableMainSection
              key={sectionId}
              sectionId={sectionId}
              isCollapsed={collapsedState.dms}
              onToggleCollapse={() => handleToggleCollapse("dms")}
              actionButton={dmsActionButton}
            >
              {renderDMs(collapsedState.dms)}
            </SortableMainSection>
          );
        case "archived":
          return (
            <SortableMainSection
              key={sectionId}
              sectionId={sectionId}
              isCollapsed={collapsedState.archived}
              onToggleCollapse={() => handleToggleCollapse("archived")}
              hasContent={hasArchivedChannels}
            >
              {renderArchived(collapsedState.archived)}
            </SortableMainSection>
          );
        default:
          return null;
      }
    },
    [
      collapsedState,
      handleToggleCollapse,
      channelsActionButton,
      dmsActionButton,
      renderChannels,
      renderDMs,
      renderArchived,
      hasArchivedChannels,
    ]
  );

  return (
    <DndContext
      id="main-sections-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
        {localOrder.map(renderSection)}
      </SortableContext>
      <DragOverlay>
        {activeId && <SectionOverlay sectionId={activeId} />}
      </DragOverlay>
    </DndContext>
  );
}
