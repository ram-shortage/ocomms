"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createConversation, getWorkspaceMembers } from "@/lib/actions/conversation";

interface Member {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
}

interface StartDMDialogProps {
  organizationId: string;
  workspaceSlug: string;
  currentUserId: string;
  trigger?: React.ReactNode;
}

export function StartDMDialog({
  organizationId,
  workspaceSlug,
  currentUserId,
  trigger,
}: StartDMDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      getWorkspaceMembers(organizationId).then(setMembers).catch(console.error);
    }
  }, [open, organizationId]);

  const availableMembers = members
    .filter((m) => m.userId !== currentUserId)
    .sort((a, b) => {
      const nameA = (a.user.name || a.user.email).toLowerCase();
      const nameB = (b.user.name || b.user.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  const isGroupDM = selectedIds.length > 1;

  const handleToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, userId]);
    } else {
      setSelectedIds(selectedIds.filter((id) => id !== userId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Select at least one member");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const conversation = await createConversation({
        organizationId,
        participantIds: selectedIds,
        name: isGroupDM ? groupName || undefined : undefined,
      });

      setOpen(false);
      setSelectedIds([]);
      setGroupName("");
      router.push(`/${workspaceSlug}/dm/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create conversation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="ghost" size="sm">New Message</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Select one or more members to message
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isGroupDM && (
            <div>
              <Label htmlFor="groupName">Group name (optional)</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Name this group..."
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-2">
            {availableMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other members in this workspace</p>
            ) : (
              availableMembers.map((member) => (
                <label
                  key={member.userId}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.includes(member.userId)}
                    onCheckedChange={(checked) =>
                      handleToggle(member.userId, checked === true)
                    }
                  />
                  <div className="flex items-center gap-2">
                    {member.user.image ? (
                      <img
                        src={member.user.image}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {(member.user.name || member.user.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.name || member.user.email}
                      </p>
                      {member.user.name && (
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      )}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || selectedIds.length === 0}>
              {loading ? "Creating..." : "Start Conversation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
