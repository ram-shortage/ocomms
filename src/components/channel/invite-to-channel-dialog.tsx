"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getWorkspaceMembers, inviteToChannel } from "@/lib/actions/channel";
import { UserPlus } from "lucide-react";

interface WorkspaceMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface InviteToChannelDialogProps {
  channelId: string;
  channelName: string;
  organizationId: string;
  existingMemberIds: string[];
  trigger?: React.ReactNode;
}

export function InviteToChannelDialog({
  channelId,
  channelName,
  organizationId,
  existingMemberIds,
  trigger,
}: InviteToChannelDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch workspace members when dialog opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError("");
      getWorkspaceMembers(organizationId)
        .then((members) => {
          setWorkspaceMembers(members as WorkspaceMember[]);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load members");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, organizationId]);

  // Filter out members who are already in the channel
  const availableMembers = workspaceMembers.filter(
    (m) => !existingMemberIds.includes(m.userId)
  );

  const toggleMember = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleInvite = async () => {
    if (selectedUserIds.length === 0) return;

    setInviting(true);
    setError("");
    setSuccess("");

    try {
      // Invite each selected member
      const results = await Promise.allSettled(
        selectedUserIds.map((userId) => inviteToChannel(channelId, userId))
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      if (failCount > 0) {
        setError(`${failCount} invitation(s) failed`);
      }

      if (successCount > 0) {
        const invitedNames = selectedUserIds
          .map((id) => availableMembers.find((m) => m.userId === id)?.user.name)
          .filter(Boolean)
          .join(", ");
        setSuccess(`Invited: ${invitedNames}`);
        setSelectedUserIds([]);
        router.refresh();

        // Close dialog after short delay to show success message
        setTimeout(() => {
          setOpen(false);
          setSuccess("");
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite members");
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to #{channelName}</DialogTitle>
          <DialogDescription>
            Select workspace members to invite to this private channel.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading members...
          </div>
        ) : availableMembers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            All workspace members are already in this channel.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {availableMembers.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => toggleMember(member.userId)}
              >
                <Checkbox
                  id={`member-${member.userId}`}
                  checked={selectedUserIds.includes(member.userId)}
                  onCheckedChange={() => toggleMember(member.userId)}
                />
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                  {member.user.image ? (
                    <img
                      src={member.user.image}
                      alt={member.user.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    member.user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`member-${member.userId}`}
                    className="text-sm font-medium truncate block cursor-pointer"
                  >
                    {member.user.name}
                  </Label>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.user.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={inviting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={inviting || selectedUserIds.length === 0 || loading}
          >
            {inviting
              ? "Inviting..."
              : `Invite ${selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
