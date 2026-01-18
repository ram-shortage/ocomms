"use client";

import { useState } from "react";
import Link from "next/link";
import { organization } from "@/lib/auth-client";
import { adminUnlockUser } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PresenceIndicator, usePresence } from "@/components/presence";

interface Member {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface MemberListProps {
  members: Member[];
  organizationId: string;
  workspaceSlug: string;
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "member";
  onMemberUpdated?: () => void;
}

export function MemberList({
  members,
  organizationId,
  workspaceSlug,
  currentUserId,
  currentUserRole,
  onMemberUpdated,
}: MemberListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { getPresence } = usePresence();

  const canManageRole = (memberRole: string) => {
    // Owner can manage anyone except other owners
    if (currentUserRole === "owner") return memberRole !== "owner";
    // Admin can manage members only
    if (currentUserRole === "admin") return memberRole === "member";
    return false;
  };

  const canRemove = (memberId: string, memberRole: string) => {
    // Can't remove yourself if you're the only owner
    if (memberId === currentUserId && memberRole === "owner") {
      const ownerCount = members.filter((m) => m.role === "owner").length;
      return ownerCount > 1;
    }
    return canManageRole(memberRole);
  };

  const canUnlock = (memberUserId: string) => {
    // Admin/owner can unlock non-self members
    if (currentUserRole === "member") return false;
    return memberUserId !== currentUserId;
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    setLoading(memberId);
    try {
      await organization.updateMemberRole({
        memberId,
        role: newRole,
        organizationId,
      });
      onMemberUpdated?.();
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;

    setLoading(memberId);
    try {
      await organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId,
      });
      onMemberUpdated?.();
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleUnlock = async (userId: string) => {
    setLoading(userId);
    try {
      await adminUnlockUser(userId, organizationId);
      // Show brief success feedback (the user's lockout is cleared)
    } catch (err) {
      console.error("Failed to unlock user:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-3 bg-white border rounded"
        >
          <div className="flex items-center gap-3">
            {/* Avatar with presence indicator */}
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                {(member.user.name?.[0] || member.user.email[0]).toUpperCase()}
              </div>
              <PresenceIndicator
                status={getPresence(member.userId)}
                size="sm"
                className="absolute -bottom-0.5 -right-0.5"
              />
            </div>
            <div>
              <Link
                href={`/${workspaceSlug}/members/${member.id}`}
                className="font-medium hover:underline"
              >
                {member.user.name || member.user.email}
                {member.userId === currentUserId && " (you)"}
              </Link>
              <p className="text-sm text-gray-500">{member.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManageRole(member.role) ? (
              <Select
                value={member.role}
                onValueChange={(v) => handleRoleChange(member.id, v as "admin" | "member")}
                disabled={loading === member.id}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="px-2 py-1 text-sm bg-gray-100 rounded capitalize">
                {member.role}
              </span>
            )}
            {canUnlock(member.userId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlock(member.userId)}
                disabled={loading === member.userId}
              >
                Unlock
              </Button>
            )}
            {canRemove(member.id, member.role) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleRemove(member.id)}
                disabled={loading === member.id}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
