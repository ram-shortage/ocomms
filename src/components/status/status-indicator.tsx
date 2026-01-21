"use client";

import { useState, useEffect } from "react";
import { StatusDisplay } from "./status-display";
import { getUserStatus } from "@/lib/actions/user-status";

interface StatusIndicatorProps {
  userId: string;
  organizationId: string;
  showText?: boolean;
}

/**
 * Fetches and displays a user's status.
 * Caches status for 30 seconds to avoid excessive fetching.
 * M-8 FIX: Requires organizationId for cross-user status lookup authorization.
 */
export function StatusIndicator({ userId, organizationId, showText = false }: StatusIndicatorProps) {
  const [status, setStatus] = useState<{
    emoji: string | null;
    text: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const result = await getUserStatus(userId, organizationId);
        if (mounted) {
          setStatus(result ? { emoji: result.emoji, text: result.text } : null);
        }
      } catch (error) {
        console.error("Failed to fetch user status:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStatus();

    // Refresh status periodically (every 30 seconds)
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [userId, organizationId]);

  if (isLoading || !status) {
    return null;
  }

  return <StatusDisplay emoji={status.emoji} text={status.text} showText={showText} />;
}
