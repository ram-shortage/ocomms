"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setConversationName } from "@/lib/actions/conversation";
import { AddParticipantsDialog } from "./add-participants-dialog";
import { NotificationBell } from "@/components/notification/notification-bell";
import Link from "next/link";

interface Participant {
  id: string;
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

interface Conversation {
  id: string;
  organizationId: string;
  isGroup: boolean;
  name: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  participants: Participant[];
}

interface DMHeaderProps {
  conversation: Conversation;
  organizationId: string;
  workspaceSlug: string;
  currentUserId: string;
}

export function DMHeader({
  conversation,
  organizationId,
  workspaceSlug,
  currentUserId,
}: DMHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(conversation.name || "");
  const [saving, setSaving] = useState(false);

  const otherParticipants = conversation.participants.filter(
    (p) => p.userId !== currentUserId
  );

  // Display name logic
  let displayName: string;
  if (conversation.isGroup) {
    displayName =
      conversation.name ||
      otherParticipants
        .map((p) => p.user.name || p.user.email)
        .slice(0, 3)
        .join(", ");
    if (!conversation.name && otherParticipants.length > 3) {
      displayName += ` +${otherParticipants.length - 3}`;
    }
  } else {
    const other = otherParticipants[0];
    displayName = other?.user.name || other?.user.email || "Unknown";
  }

  const handleSaveName = async () => {
    if (!conversation.isGroup) return;

    setSaving(true);
    try {
      await setConversationName(conversation.id, name);
      setIsEditingName(false);
    } catch (err) {
      console.error("Failed to save name:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <Link
            href={`/${workspaceSlug}`}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>

          {/* Avatars */}
          <div className="flex -space-x-2">
            {otherParticipants.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium"
                title={p.user.name || p.user.email}
              >
                {p.user.image ? (
                  <img
                    src={p.user.image}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (p.user.name || p.user.email)[0].toUpperCase()
                )}
              </div>
            ))}
            {otherParticipants.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium">
                +{otherParticipants.length - 3}
              </div>
            )}
          </div>

          {/* Name / Edit name */}
          {isEditingName && conversation.isGroup ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                className="h-8 w-48"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveName} disabled={saving}>
                {saving ? "..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditingName(false);
                  setName(conversation.name || "");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-medium">{displayName}</h1>
              {conversation.isGroup && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Edit name"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Participant count */}
          <span className="text-sm text-gray-500">
            {conversation.participants.length} member{conversation.participants.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <NotificationBell workspaceSlug={workspaceSlug} />
          <AddParticipantsDialog
            conversationId={conversation.id}
            organizationId={organizationId}
            existingParticipantIds={conversation.participants.map((p) => p.userId)}
          />
        </div>
      </div>
    </div>
  );
}
