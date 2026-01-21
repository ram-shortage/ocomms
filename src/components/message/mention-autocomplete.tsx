"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export interface MentionMember {
  id: string;
  name: string | null;
  email: string;
}

export interface MentionGroup {
  id: string;
  name: string;
  handle: string;
  memberCount: number;
}

interface SpecialMention {
  type: "channel" | "here";
  label: string;
  description: string;
}

const SPECIAL_MENTIONS: SpecialMention[] = [
  { type: "channel", label: "@channel", description: "Notify all members" },
  { type: "here", label: "@here", description: "Notify active members" },
];

interface MentionAutocompleteProps {
  members: MentionMember[];
  groups?: MentionGroup[];
  filter: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({
  members,
  groups = [],
  filter,
  onSelect,
  onClose,
  position,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");
  const containerRef = useRef<HTMLDivElement>(null);

  const lowerFilter = filter.toLowerCase();
  const hasGroups = groups.length > 0;

  // Filter special mentions (only in users tab)
  const filteredSpecial = activeTab === "users"
    ? SPECIAL_MENTIONS.filter(
        (s) =>
          filter === "" ||
          s.type.startsWith(lowerFilter) ||
          s.label.toLowerCase().includes(lowerFilter)
      )
    : [];

  // Filter members by name or email starting with filter
  const filteredMembers = members.filter((m) => {
    if (filter === "") return true;
    const name = m.name?.toLowerCase() || "";
    const email = m.email.toLowerCase();
    return name.startsWith(lowerFilter) || email.startsWith(lowerFilter);
  });

  // Filter groups by name or handle
  const filteredGroups = groups.filter((g) => {
    if (filter === "") return true;
    return (
      g.name.toLowerCase().startsWith(lowerFilter) ||
      g.handle.toLowerCase().startsWith(lowerFilter)
    );
  });

  // Build results based on active tab
  type ResultItem =
    | { type: "special"; data: SpecialMention }
    | { type: "member"; data: MentionMember }
    | { type: "group"; data: MentionGroup };

  const results: ResultItem[] =
    activeTab === "users"
      ? [
          ...filteredSpecial.map((s) => ({ type: "special" as const, data: s })),
          ...filteredMembers.slice(0, 5 - filteredSpecial.length).map((m) => ({
            type: "member" as const,
            data: m,
          })),
        ].slice(0, 5)
      : filteredGroups.slice(0, 5).map((g) => ({
          type: "group" as const,
          data: g,
        }));

  // Reset selection when tab or filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, activeTab]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (results.length > 0) {
            setSelectedIndex((prev) => (prev + 1) % results.length);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (results.length > 0) {
            setSelectedIndex((prev) =>
              prev === 0 ? results.length - 1 : prev - 1
            );
          }
          break;
        case "ArrowLeft":
          if (hasGroups && activeTab === "groups") {
            e.preventDefault();
            setActiveTab("users");
          }
          break;
        case "ArrowRight":
          if (hasGroups && activeTab === "users") {
            e.preventDefault();
            setActiveTab("groups");
          }
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) {
            if (selected.type === "special") {
              onSelect(selected.data.type);
            } else if (selected.type === "member") {
              const name = selected.data.name || selected.data.email.split("@")[0];
              onSelect(name);
            } else {
              // Group - use handle
              onSelect(selected.data.handle);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, onSelect, onClose, hasGroups, activeTab]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Show nothing if no results and no tabs to show
  const hasAnyContent =
    results.length > 0 ||
    (hasGroups && (filteredMembers.length > 0 || filteredGroups.length > 0 || filteredSpecial.length > 0));

  if (!hasAnyContent && !hasGroups) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-popover border rounded-lg shadow-lg overflow-hidden"
      style={{ bottom: position.top, left: position.left }}
    >
      {/* Tab headers - only show if there are groups */}
      {hasGroups && (
        <div className="flex border-b text-sm">
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-center transition-colors",
              activeTab === "users"
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-center transition-colors",
              activeTab === "groups"
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("groups")}
          >
            Groups
          </button>
        </div>
      )}

      {/* Results */}
      <div className="py-1">
        {results.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {activeTab === "users" ? "No users found" : "No groups found"}
          </div>
        ) : (
          results.map((result, index) => (
            <button
              key={
                result.type === "special"
                  ? result.data.type
                  : result.type === "group"
                    ? `group-${result.data.id}`
                    : result.data.id
              }
              type="button"
              className={cn(
                "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-muted",
                index === selectedIndex && "bg-muted"
              )}
              onClick={() => {
                if (result.type === "special") {
                  onSelect(result.data.type);
                } else if (result.type === "member") {
                  const name = result.data.name || result.data.email.split("@")[0];
                  onSelect(name);
                } else {
                  onSelect(result.data.handle);
                }
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {result.type === "special" ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-medium">
                    @
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {result.data.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {result.data.description}
                    </div>
                  </div>
                </>
              ) : result.type === "member" ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
                    {result.data.name?.[0]?.toUpperCase() ||
                      result.data.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {result.data.name || result.data.email.split("@")[0]}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {result.data.email}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {result.data.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      @{result.data.handle} - {result.data.memberCount}{" "}
                      {result.data.memberCount === 1 ? "member" : "members"}
                    </div>
                  </div>
                </>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
