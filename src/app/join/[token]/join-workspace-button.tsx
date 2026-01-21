"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { redeemGuestInvite } from "@/lib/actions/guest";

interface JoinWorkspaceButtonProps {
  token: string;
  organizationSlug: string;
}

export function JoinWorkspaceButton({
  token,
  organizationSlug,
}: JoinWorkspaceButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await redeemGuestInvite(token);

      if (result.success && result.organizationSlug) {
        // Set flag to show welcome modal on first visit
        if (typeof window !== "undefined") {
          localStorage.setItem(
            `guest-welcome-${result.organizationId}`,
            "show"
          );
        }
        // Redirect to workspace
        router.push(`/${result.organizationSlug}`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to join workspace. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        size="lg"
        onClick={handleJoin}
        disabled={loading}
      >
        {loading ? "Joining..." : "Join Workspace"}
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
