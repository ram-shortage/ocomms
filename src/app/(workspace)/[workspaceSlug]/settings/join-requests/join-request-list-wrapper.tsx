"use client";

import { useRouter } from "next/navigation";
import { JoinRequestList } from "@/components/workspace/join-request-list";
import {
  approveJoinRequest,
  rejectJoinRequest,
  bulkApproveRequests,
  bulkRejectRequests,
} from "@/lib/actions/workspace-join";

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

interface JoinRequestListWrapperProps {
  initialRequests: JoinRequest[];
}

export function JoinRequestListWrapper({ initialRequests }: JoinRequestListWrapperProps) {
  const router = useRouter();

  const handleApprove = async (requestId: string) => {
    await approveJoinRequest(requestId);
    router.refresh();
  };

  const handleReject = async (requestId: string, reason?: string) => {
    await rejectJoinRequest(requestId, reason);
    router.refresh();
  };

  const handleBulkApprove = async (requestIds: string[]) => {
    await bulkApproveRequests(requestIds);
    router.refresh();
  };

  const handleBulkReject = async (requestIds: string[], reason?: string) => {
    await bulkRejectRequests(requestIds, reason);
    router.refresh();
  };

  return (
    <JoinRequestList
      requests={initialRequests}
      onApprove={handleApprove}
      onReject={handleReject}
      onBulkApprove={handleBulkApprove}
      onBulkReject={handleBulkReject}
    />
  );
}
