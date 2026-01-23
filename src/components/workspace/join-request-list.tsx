"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon, XIcon } from "lucide-react";

interface JoinRequest {
  id: string;
  userId: string;
  message: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

interface JoinRequestListProps {
  requests: JoinRequest[];
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason?: string) => Promise<void>;
  onBulkApprove: (requestIds: string[]) => Promise<void>;
  onBulkReject: (requestIds: string[], reason?: string) => Promise<void>;
}

export function JoinRequestList({
  requests,
  onApprove,
  onReject,
  onBulkApprove,
  onBulkReject,
}: JoinRequestListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const allSelected = requests.length > 0 && selectedIds.size === requests.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < requests.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  };

  const toggleRequest = (requestId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedIds(newSelected);
  };

  const handleApprove = async (requestId: string) => {
    setLoadingId(requestId);
    setError("");
    setSuccess("");
    try {
      await onApprove(requestId);
      setSuccess("Request approved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setLoadingId(null);
    }
  };

  const handleRejectClick = (requestId: string) => {
    setRejectingRequestId(requestId);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectingRequestId) return;

    setLoadingId(rejectingRequestId);
    setError("");
    setSuccess("");
    setRejectDialogOpen(false);
    try {
      await onReject(rejectingRequestId, rejectReason || undefined);
      setSuccess("Request rejected");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setLoadingId(null);
      setRejectingRequestId(null);
      setRejectReason("");
    }
  };

  const handleBulkApprove = async () => {
    setBulkLoading(true);
    setError("");
    setSuccess("");
    try {
      await onBulkApprove(Array.from(selectedIds));
      setSuccess(`Approved ${selectedIds.size} request(s)`);
      setTimeout(() => setSuccess(""), 3000);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve requests");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkRejectClick = () => {
    setBulkRejectReason("");
    setBulkRejectDialogOpen(true);
  };

  const handleBulkRejectConfirm = async () => {
    setBulkLoading(true);
    setError("");
    setSuccess("");
    setBulkRejectDialogOpen(false);
    try {
      await onBulkReject(Array.from(selectedIds), bulkRejectReason || undefined);
      setSuccess(`Rejected ${selectedIds.size} request(s)`);
      setTimeout(() => setSuccess(""), 3000);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject requests");
    } finally {
      setBulkLoading(false);
      setBulkRejectReason("");
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  };

  if (requests.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No pending join requests
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions header */}
      {requests.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all requests"
            className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size === 0 ? "Select all" : `${selectedIds.size} selected`}
          </span>
          {selectedIds.size > 0 && (
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkApprove}
                disabled={bulkLoading}
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkRejectClick}
                disabled={bulkLoading}
              >
                <XIcon className="h-4 w-4 mr-1" />
                Reject Selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Error/Success messages */}
      {error && <p className="text-sm text-red-600 p-2 bg-red-50 rounded">{error}</p>}
      {success && <p className="text-sm text-green-600 p-2 bg-green-50 rounded">{success}</p>}

      {/* Request list */}
      <div className="space-y-2">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center gap-3 p-4 bg-card border rounded"
          >
            <Checkbox
              checked={selectedIds.has(request.id)}
              onCheckedChange={() => toggleRequest(request.id)}
              disabled={loadingId === request.id}
            />

            {/* User avatar */}
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
              {(request.user.name?.[0] || request.user.email[0]).toUpperCase()}
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{request.user.name || request.user.email}</div>
              <div className="text-sm text-muted-foreground truncate">{request.user.email}</div>
              {request.message && (
                <div className="text-sm mt-1 text-muted-foreground line-clamp-2">
                  Message: {request.message}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                Requested {getTimeAgo(request.createdAt)}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => handleApprove(request.id)}
                disabled={loadingId === request.id}
              >
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleRejectClick(request.id)}
                disabled={loadingId === request.id}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Join Request</DialogTitle>
            <DialogDescription>
              You can optionally provide a reason for rejection. This will be sent to the requester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Not accepting new members at this time"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectDialogOpen} onOpenChange={setBulkRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.size} Request(s)</DialogTitle>
            <DialogDescription>
              You can optionally provide a reason for rejection. This will be sent to all requesters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-reject-reason">Reason (optional)</Label>
            <Input
              id="bulk-reject-reason"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="e.g., Not accepting new members at this time"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkRejectConfirm}>
              Reject {selectedIds.size} Request(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
