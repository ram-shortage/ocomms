"use client";

import { useState } from "react";
import Link from "next/link";
import { organization } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-3 bg-white border rounded"
        >
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
