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
import { Checkbox } from "@/components/ui/checkbox";
import { addParticipant, getWorkspaceMembers } from "@/lib/actions/conversation";

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

interface AddParticipantsDialogProps {
  conversationId: string;
  organizationId: string;
  existingParticipantIds: string[];
}

export function AddParticipantsDialog({
  conversationId,
  organizationId,
  existingParticipantIds,
}: AddParticipantsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      getWorkspaceMembers(organizationId).then(setMembers).catch(console.error);
    }
  }, [open, organizationId]);

  // Filter out members already in conversation
  const availableMembers = members.filter(
    (m) => !existingParticipantIds.includes(m.userId)
  );

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
      // Add each participant
      for (const userId of selectedIds) {
        await addParticipant(conversationId, userId);
      }

      setOpen(false);
      setSelectedIds([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add participants");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add people
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>
            Add more members to this conversation
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-60 overflow-y-auto space-y-2">
            {availableMembers.length === 0 ? (
              <p className="text-sm text-gray-500">
                All workspace members are already in this conversation
              </p>
            ) : (
              availableMembers.map((member) => (
                <label
                  key={member.userId}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
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
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                        {(member.user.name || member.user.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.name || member.user.email}
                      </p>
                      {member.user.name && (
                        <p className="text-xs text-gray-500">{member.user.email}</p>
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
              {loading ? "Adding..." : `Add${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
