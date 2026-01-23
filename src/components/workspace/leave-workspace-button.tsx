"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { leaveWorkspace } from "@/lib/actions/workspace-join";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LeaveWorkspaceButtonProps {
  workspaceId: string;
  workspaceName: string;
  userRole: "owner" | "admin" | "member";
  ownerCount: number;
}

export function LeaveWorkspaceButton({
  workspaceId,
  workspaceName,
  userRole,
  ownerCount,
}: LeaveWorkspaceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  const isOnlyOwner = userRole === "owner" && ownerCount === 1;

  const handleLeave = async () => {
    setLeaving(true);
    setError("");
    try {
      await leaveWorkspace(workspaceId);
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave workspace");
      setLeaving(false);
    }
  };

  if (isOnlyOwner) {
    return (
      <div className="p-4 bg-card border rounded">
        <h3 className="font-medium text-destructive">Leave Workspace</h3>
        <p className="text-sm text-muted-foreground mt-1">
          You are the only owner of this workspace. To leave, you must first
          transfer ownership to another member.
        </p>
        <Button variant="destructive" disabled className="mt-3">
          <LogOut className="h-4 w-4 mr-2" />
          Leave Workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border rounded">
      <h3 className="font-medium text-destructive">Leave Workspace</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Once you leave, you will lose access to all channels and messages in this
        workspace.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" className="mt-3">
            <LogOut className="h-4 w-4 mr-2" />
            Leave Workspace
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {workspaceName}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this workspace? You will lose access
              to all channels and messages. You may need to be re-invited to
              rejoin.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={leaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving ? "Leaving..." : "Leave Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
