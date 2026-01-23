"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceBrowseCard } from "@/components/workspace/workspace-browse-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  getAvailableWorkspaces,
  getMyJoinRequests,
  joinOpenWorkspace,
  submitJoinRequest,
} from "@/lib/actions/workspace-join";

interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  description: string | null;
  memberCount: number;
  joinPolicy: string;
}

export default function BrowseWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [pendingRequestIds, setPendingRequestIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null
  );
  const [requestMessage, setRequestMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);

      const [availableWorkspaces, pendingRequests] = await Promise.all([
        getAvailableWorkspaces(),
        getMyJoinRequests(),
      ]);

      setWorkspaces(availableWorkspaces);
      setPendingRequestIds(
        new Set(pendingRequests.map((r) => r.workspaceId))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workspaces"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOpen = async (workspace: Workspace) => {
    try {
      const result = await joinOpenWorkspace(workspace.id);
      if (result.success && result.slug) {
        toast.success(`Joined ${workspace.name}!`);
        router.push(`/${result.slug}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to join workspace"
      );
    }
  };

  const handleRequestToJoin = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setRequestMessage("");
    setRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedWorkspace) return;

    try {
      setSubmitting(true);
      await submitJoinRequest(selectedWorkspace.id, requestMessage);
      toast.success("Join request submitted successfully!");
      setRequestDialogOpen(false);
      setPendingRequestIds(
        new Set([...pendingRequestIds, selectedWorkspace.id])
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit request"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold mb-2">Browse Workspaces</h1>
          <p className="text-muted-foreground">
            Discover and join workspaces to collaborate with others
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-6 border rounded-lg bg-card">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-10 h-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadWorkspaces}>Retry</Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && workspaces.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No workspaces available to join
            </p>
            <Button onClick={() => router.push("/create-workspace")}>
              Create Workspace
            </Button>
          </div>
        )}

        {/* Workspaces Grid */}
        {!loading && !error && workspaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <WorkspaceBrowseCard
                key={workspace.id}
                workspace={workspace}
                isPending={pendingRequestIds.has(workspace.id)}
                onJoin={() => handleJoinOpen(workspace)}
                onRequest={() => handleRequestToJoin(workspace)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Request to Join Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Join {selectedWorkspace?.name}</DialogTitle>
            <DialogDescription>
              Send a request to join this workspace. You can include an
              optional message to the workspace admins.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="message" className="mb-2 block">
              Message (optional)
            </Label>
            <Textarea
              id="message"
              placeholder="Tell the admins why you'd like to join..."
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
