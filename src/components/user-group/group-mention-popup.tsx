"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getGroupByHandle, getGroupMembers } from "@/lib/actions/user-group";

interface GroupMember {
  userId: string;
  name: string | null;
  email?: string; // Optional - hidden for non-admins (M-9)
  image: string | null;
}

interface GroupMentionPopupProps {
  handle: string;
  organizationId: string;
  children: React.ReactNode;
}

/**
 * UGRP-03: Click group mention to view members
 *
 * A light popover that shows group info and members when clicking
 * a group mention in a message.
 */
export function GroupMentionPopup({
  handle,
  organizationId,
  children,
}: GroupMentionPopupProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<{
    id: string;
    name: string;
    handle: string;
    description: string | null;
    memberCount: number;
  } | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  // Load group data when popover opens
  useEffect(() => {
    if (!open) return;

    async function loadGroup() {
      setLoading(true);
      try {
        const groupData = await getGroupByHandle(organizationId, handle);
        if (groupData) {
          setGroup(groupData);
          const membersData = await getGroupMembers(groupData.id);
          setMembers(membersData);
        }
      } catch (err) {
        console.error("Failed to load group:", err);
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [open, handle, organizationId]);

  const displayedMembers = members.slice(0, 5);
  const remainingCount = members.length - 5;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span className="cursor-pointer">{children}</span>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !group ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Group not found
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{group.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    @{group.handle} - {group.memberCount}{" "}
                    {group.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
              </div>
              {group.description && (
                <p className="text-xs text-muted-foreground mt-2">
                  {group.description}
                </p>
              )}
            </div>

            {/* Member list */}
            <div className="py-2">
              {displayedMembers.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-2 px-3 py-1.5"
                >
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {m.image ? (
                      <img
                        src={m.image}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      (m.name || m.email || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm truncate">
                    {m.name || m.email?.split("@")[0] || "Unknown"}
                  </span>
                </div>
              ))}

              {remainingCount > 0 && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground">
                  +{remainingCount} more member{remainingCount !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
