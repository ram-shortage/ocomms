"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hash, Lock, Users, Settings, LogOut, Check, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { leaveChannel, updateChannelTopic } from "@/lib/actions/channel";
import { InviteToChannelDialog } from "./invite-to-channel-dialog";
import { PinnedMessagesDialog } from "./pinned-messages-dialog";
import { NotificationBell } from "@/components/notification/notification-bell";
import { NotificationSettingsDialog } from "./notification-settings-dialog";
import { ChannelNotesSheet } from "./channel-notes-sheet";
import type { NotificationMode } from "@/db/schema/channel-notification-settings";

interface ChannelMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

interface ChannelHeaderProps {
  channel: {
    id: string;
    name: string;
    slug: string;
    topic: string | null;
    description: string | null;
    isPrivate: boolean;
    memberCount: number;
  };
  organizationId: string;
  workspaceSlug: string;
  isAdmin: boolean;
  members: ChannelMember[];
  currentUserId: string;
  notificationMode: NotificationMode;
}

export function ChannelHeader({
  channel,
  organizationId,
  workspaceSlug,
  isAdmin,
  members,
  currentUserId,
  notificationMode,
}: ChannelHeaderProps) {
  const router = useRouter();
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topic, setTopic] = useState(channel.topic || "");
  const [savingTopic, setSavingTopic] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [currentNotificationMode, setCurrentNotificationMode] = useState<NotificationMode>(notificationMode);

  const handleSaveTopic = async () => {
    setSavingTopic(true);
    setError("");
    try {
      await updateChannelTopic(channel.id, topic);
      setIsEditingTopic(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update topic");
    } finally {
      setSavingTopic(false);
    }
  };

  const handleCancelTopic = () => {
    setTopic(channel.topic || "");
    setIsEditingTopic(false);
  };

  const handleLeave = async () => {
    setLeaving(true);
    setError("");
    try {
      await leaveChannel(channel.id);
      setShowLeaveDialog(false);
      router.push(`/${workspaceSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave channel");
      setLeaving(false);
    }
  };

  return (
    <header className="border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {channel.isPrivate ? (
              <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <h1 className="font-semibold text-lg truncate">{channel.name}</h1>
          </div>

          {/* Topic - inline editable */}
          <div className="flex-1 min-w-0">
            {isEditingTopic ? (
              <div className="flex items-center gap-2">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Add a topic..."
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTopic();
                    if (e.key === "Escape") handleCancelTopic();
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleSaveTopic}
                  disabled={savingTopic}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleCancelTopic}
                  disabled={savingTopic}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingTopic(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate text-left"
              >
                {channel.topic || "Add a topic..."}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}

          {/* Channel notification settings */}
          <NotificationSettingsDialog
            channelId={channel.id}
            channelName={channel.name}
            currentMode={currentNotificationMode}
            onModeChange={setCurrentNotificationMode}
          />

          {/* Channel notes */}
          <ChannelNotesSheet
            channelId={channel.id}
            channelName={channel.name}
          />

          {/* Global notifications */}
          <NotificationBell workspaceSlug={workspaceSlug} />

          {/* Pinned messages */}
          <PinnedMessagesDialog channelId={channel.id} currentUserId={currentUserId} />

          {/* Members button */}
          <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Users className="h-4 w-4" />
                <span>{channel.memberCount}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Channel Members</DialogTitle>
                <DialogDescription>
                  {channel.memberCount} member{channel.memberCount !== 1 ? "s" : ""} in #{channel.name}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={member.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    {member.role === "admin" && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Invite to private channel (admin only) */}
          {isAdmin && channel.isPrivate && (
            <InviteToChannelDialog
              channelId={channel.id}
              channelName={channel.name}
              organizationId={organizationId}
              existingMemberIds={members.map((m) => m.id)}
            />
          )}

          {/* Settings link (admin only) */}
          {isAdmin && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/${workspaceSlug}/channels/${channel.slug}/settings`}>
                <Settings className="h-4 w-4" />
                <span className="sr-only">Channel settings</span>
              </Link>
            </Button>
          )}

          {/* Leave channel button */}
          <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Leave channel</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Leave #{channel.name}?</DialogTitle>
                <DialogDescription>
                  You can rejoin this channel at any time from the channel directory.
                  {channel.isPrivate && " However, for private channels, you will need to be re-invited."}
                </DialogDescription>
              </DialogHeader>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowLeaveDialog(false)}
                  disabled={leaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLeave}
                  disabled={leaving}
                >
                  {leaving ? "Leaving..." : "Leave Channel"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
