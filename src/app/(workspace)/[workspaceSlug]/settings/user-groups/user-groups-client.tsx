"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserGroupList } from "@/components/user-group/user-group-list";
import { UserGroupForm } from "@/components/user-group/user-group-form";
import { GroupMemberManager } from "@/components/user-group/group-member-manager";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { UserGroup } from "@/components/user-group/user-group-list";

interface UserGroupsClientProps {
  organizationId: string;
  workspaceSlug: string;
  initialGroups: UserGroup[];
}

export function UserGroupsClient({
  organizationId,
  workspaceSlug,
  initialGroups,
}: UserGroupsClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [managingMembersGroup, setManagingMembersGroup] = useState<UserGroup | null>(null);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleCreateNew = () => {
    setEditingGroup(null);
    setShowForm(true);
  };

  const handleEdit = (group: UserGroup) => {
    setEditingGroup(group);
    setShowForm(true);
  };

  const handleManageMembers = (group: UserGroup) => {
    setManagingMembersGroup(group);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingGroup(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    handleRefresh();
  };

  const handleMemberManagerClose = () => {
    setManagingMembersGroup(null);
    handleRefresh();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Groups</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create groups for @mentions
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>

        <UserGroupList
          groups={initialGroups}
          onEdit={handleEdit}
          onManageMembers={handleManageMembers}
          onDelete={handleRefresh}
        />

        {/* Create/Edit form dialog */}
        {showForm && (
          <UserGroupForm
            organizationId={organizationId}
            group={editingGroup}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Member manager sheet */}
        {managingMembersGroup && (
          <GroupMemberManager
            organizationId={organizationId}
            group={managingMembersGroup}
            onClose={handleMemberManagerClose}
          />
        )}

        <div className="pt-4">
          <Link
            href={`/${workspaceSlug}/settings`}
            className="text-sm text-primary hover:underline"
          >
            Back to settings
          </Link>
        </div>
      </div>
    </div>
  );
}
