"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createUserGroup, updateUserGroup, getGroupByHandle } from "@/lib/actions/user-group";
import type { UserGroup } from "./user-group-list";

interface UserGroupFormProps {
  organizationId: string;
  group?: UserGroup | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserGroupForm({
  organizationId,
  group,
  onClose,
  onSuccess,
}: UserGroupFormProps) {
  const isEditing = !!group;

  const [name, setName] = useState(group?.name ?? "");
  const [handle, setHandle] = useState(group?.handle ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);

  // Normalize handle on change
  const handleHandleChange = (value: string) => {
    // Auto-lowercase and remove invalid characters
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setHandle(normalized);
    setHandleError(null);
  };

  // Check handle uniqueness on blur
  const checkHandleUniqueness = async () => {
    if (!handle || (isEditing && handle === group?.handle)) {
      return;
    }

    setIsCheckingHandle(true);
    try {
      const existing = await getGroupByHandle(organizationId, handle);
      if (existing && (!isEditing || existing.id !== group?.id)) {
        setHandleError(`@${handle} is already taken`);
      }
    } catch {
      // Ignore errors - validation will happen on save
    } finally {
      setIsCheckingHandle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !handle.trim()) {
      setError("Name and handle are required");
      return;
    }

    if (handleError) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await updateUserGroup(group.id, {
          name: name.trim(),
          handle: handle.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createUserGroup(
          organizationId,
          name.trim(),
          handle.trim(),
          description.trim() || undefined
        );
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit User Group" : "Create User Group"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Design Team"
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => handleHandleChange(e.target.value)}
                onBlur={checkHandleUniqueness}
                placeholder="e.g., design"
                className="pl-7"
                disabled={isSaving}
              />
            </div>
            {isCheckingHandle && (
              <p className="text-xs text-muted-foreground">Checking availability...</p>
            )}
            {handleError && (
              <p className="text-xs text-red-500">{handleError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and underscores only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group for?"
              rows={2}
              disabled={isSaving}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !name.trim() || !handle.trim() || !!handleError}
            >
              {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
