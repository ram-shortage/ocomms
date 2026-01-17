"use client";

import { type ReactNode } from "react";
import { PresenceProvider } from "./presence-provider";

interface PresenceWrapperProps {
  children: ReactNode;
  workspaceId: string;
  memberUserIds?: string[];
}

/**
 * Client wrapper for PresenceProvider.
 * Used by server layouts to provide presence context.
 */
export function PresenceWrapper({
  children,
  workspaceId,
  memberUserIds = [],
}: PresenceWrapperProps) {
  return (
    <PresenceProvider workspaceId={workspaceId} initialUserIds={memberUserIds}>
      {children}
    </PresenceProvider>
  );
}
