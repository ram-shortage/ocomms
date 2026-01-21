"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Users, Trash2 } from "lucide-react";
import { deleteUserGroup } from "@/lib/actions/user-group";

export interface UserGroup {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  memberCount: number;
  createdAt: Date;
}

interface UserGroupListProps {
  groups: UserGroup[];
  onEdit: (group: UserGroup) => void;
  onManageMembers: (group: UserGroup) => void;
  onDelete: () => void;
}

export function UserGroupList({
  groups,
  onEdit,
  onManageMembers,
  onDelete,
}: UserGroupListProps) {
  const [deleteTarget, setDeleteTarget] = useState<UserGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteUserGroup(deleteTarget.id);
      setDeleteTarget(null);
      onDelete();
    } catch (err) {
      console.error("Failed to delete group:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          No user groups yet. Create one to enable @group mentions.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg divide-y">
        {groups.map((group) => (
          <div
            key={group.id}
            className="flex items-center justify-between p-4 hover:bg-muted/30"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{group.name}</h3>
                <span className="text-sm text-muted-foreground">
                  @{group.handle}
                </span>
              </div>
              {group.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {group.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageMembers(group)}
              >
                <Users className="h-4 w-4 mr-1" />
                Members
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(group)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-red-500"
                onClick={() => setDeleteTarget(group)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This will remove all members from the group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
