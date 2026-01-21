"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, Search, UserPlus } from "lucide-react";
import {
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
} from "@/lib/actions/user-group";
import { getWorkspaceMembers } from "@/lib/actions/channel";
import type { UserGroup } from "./user-group-list";

interface GroupMember {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  isGuest: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface GroupMemberManagerProps {
  organizationId: string;
  group: UserGroup;
  onClose: () => void;
}

export function GroupMemberManager({
  organizationId,
  group,
  onClose,
}: GroupMemberManagerProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load members on mount
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [groupMembersData, workspaceMembersData] = await Promise.all([
          getGroupMembers(group.id),
          getWorkspaceMembers(organizationId),
        ]);
        setMembers(groupMembersData);
        setWorkspaceMembers(workspaceMembersData as WorkspaceMember[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load members");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [group.id, organizationId]);

  // Get members not in group, excluding guests
  const memberUserIds = new Set(members.map((m) => m.userId));
  const availableMembers = workspaceMembers.filter(
    (m) => !memberUserIds.has(m.userId) && !m.isGuest
  );

  // Filter by search
  const filteredAvailable = search
    ? availableMembers.filter(
        (m) =>
          m.user.name.toLowerCase().includes(search.toLowerCase()) ||
          m.user.email.toLowerCase().includes(search.toLowerCase())
      )
    : availableMembers;

  // Guests in workspace (for showing tooltip)
  const guestMembers = workspaceMembers.filter(
    (m) => !memberUserIds.has(m.userId) && m.isGuest
  );
  const filteredGuests = search
    ? guestMembers.filter(
        (m) =>
          m.user.name.toLowerCase().includes(search.toLowerCase()) ||
          m.user.email.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const handleAdd = async (userId: string) => {
    setAdding(userId);
    setError(null);
    try {
      await addGroupMember(group.id, userId);
      // Refresh members
      const updated = await getGroupMembers(group.id);
      setMembers(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    setError(null);
    try {
      await removeGroupMember(group.id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Members - {group.name}</SheetTitle>
          <SheetDescription>
            @{group.handle} - Add or remove group members
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading members...
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Add member section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Add Member</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workspace members..."
                  className="pl-9"
                />
              </div>

              {search && (
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {filteredAvailable.length === 0 && filteredGuests.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No members found
                    </div>
                  ) : (
                    <>
                      {filteredAvailable.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between p-3 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                              {m.user.image ? (
                                <img
                                  src={m.user.image}
                                  alt=""
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                m.user.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {m.user.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {m.user.email}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAdd(m.userId)}
                            disabled={adding === m.userId}
                          >
                            {adding === m.userId ? (
                              "Adding..."
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}

                      {/* Show guests with tooltip explaining why they can't be added (GUST-07) */}
                      <TooltipProvider>
                        {filteredGuests.map((m) => (
                          <Tooltip key={m.userId}>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-between p-3 opacity-50 cursor-not-allowed">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                                    {m.user.image ? (
                                      <img
                                        src={m.user.image}
                                        alt=""
                                        className="h-8 w-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      m.user.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium truncate">
                                        {m.user.name}
                                      </p>
                                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                        Guest
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {m.user.email}
                                    </p>
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" disabled>
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Guests cannot be added to groups
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </>
                  )}
                </div>
              )}

              {!search && availableMembers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {availableMembers.length} member{availableMembers.length !== 1 ? "s" : ""} available to add
                </p>
              )}
            </div>

            {/* Current members section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                Current Members ({members.length})
              </h3>

              {members.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-md">
                  No members yet. Search above to add members.
                </div>
              ) : (
                <div className="border rounded-md divide-y">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                          {m.image ? (
                            <img
                              src={m.image}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            (m.name || m.email).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.name || m.email.split("@")[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-red-500"
                        onClick={() => handleRemove(m.userId)}
                        disabled={removing === m.userId}
                      >
                        {removing === m.userId ? (
                          "..."
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
