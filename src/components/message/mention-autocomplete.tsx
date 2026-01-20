"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface MentionMember {
  id: string;
  name: string | null;
  email: string;
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
  filter: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function MentionAutocomplete({
  members,
  filter,
  onSelect,
  onClose,
  position,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const lowerFilter = filter.toLowerCase();

  // Filter special mentions
  const filteredSpecial = SPECIAL_MENTIONS.filter(
    (s) =>
      filter === "" ||
      s.type.startsWith(lowerFilter) ||
      s.label.toLowerCase().includes(lowerFilter)
  );

  // Filter members by name or email starting with filter
  const filteredMembers = members.filter((m) => {
    if (filter === "") return true;
    const name = m.name?.toLowerCase() || "";
    const email = m.email.toLowerCase();
    return name.startsWith(lowerFilter) || email.startsWith(lowerFilter);
  });

  // Combine results, max 5 total
  const results = [
    ...filteredSpecial.map((s) => ({ type: "special" as const, data: s })),
    ...filteredMembers.slice(0, 5 - filteredSpecial.length).map((m) => ({
      type: "member" as const,
      data: m,
    })),
  ].slice(0, 5);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev === 0 ? results.length - 1 : prev - 1
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) {
            if (selected.type === "special") {
              onSelect(selected.data.type);
            } else {
              // Use name if available, otherwise email username
              const name = selected.data.name || selected.data.email.split("@")[0];
              onSelect(name);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, onSelect, onClose]
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

  if (results.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-64 bg-popover border rounded-lg shadow-lg overflow-hidden"
      style={{ bottom: position.top, left: position.left }}
    >
      <div className="py-1">
        {results.map((result, index) => (
          <button
            key={
              result.type === "special"
                ? result.data.type
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
              } else {
                const name = result.data.name || result.data.email.split("@")[0];
                onSelect(name);
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
            ) : (
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
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
