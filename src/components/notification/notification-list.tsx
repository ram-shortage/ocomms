"use client";

import { formatDistanceToNow } from "date-fns";
import { AtSign, Hash, Users, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/socket-events";

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onNavigate?: (notification: Notification) => void;
}

/**
 * Get icon for notification type.
 */
function NotificationIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "mention":
      return <AtSign className="h-4 w-4 text-blue-500" />;
    case "channel":
      return <Users className="h-4 w-4 text-amber-500" />;
    case "here":
      return <Hash className="h-4 w-4 text-amber-500" />;
    case "thread_reply":
      return <AtSign className="h-4 w-4 text-purple-500" />;
    default:
      return <AtSign className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Get label for notification type.
 */
function getTypeLabel(type: Notification["type"]): string {
  switch (type) {
    case "mention":
      return "mentioned you";
    case "channel":
      return "notified @channel";
    case "here":
      return "notified @here";
    case "thread_reply":
      return "replied in thread";
    default:
      return "notification";
  }
}

export function NotificationList({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationListProps) {
  const hasUnread = notifications.some((n) => !n.readAt);

  const handleClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.readAt) {
      onMarkRead(notification.id);
    }
    // Navigate to message if handler provided
    onNavigate?.(notification);
  };

  if (notifications.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header with mark all read */}
      {hasUnread && (
        <div className="flex justify-end px-2 pb-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            className="text-xs gap-1"
          >
            <CheckCheck className="h-3 w-3" />
            Mark all as read
          </Button>
        </div>
      )}

      {/* Notification items */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.map((notification) => {
          const isUnread = !notification.readAt;

          return (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-muted transition-colors",
                isUnread && "border-l-2 border-blue-500 bg-blue-50/50"
              )}
            >
              <div className="flex items-start gap-2">
                {/* Type icon */}
                <div className="mt-0.5 shrink-0">
                  <NotificationIcon type={notification.type} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Actor and action */}
                  <div className="flex items-center gap-1 text-sm">
                    <span className={cn("font-medium", isUnread && "text-foreground")}>
                      {notification.actorName || "Someone"}
                    </span>
                    <span className="text-muted-foreground">
                      {getTypeLabel(notification.type)}
                    </span>
                    {notification.channelName && (
                      <span className="text-muted-foreground">
                        in #{notification.channelName}
                      </span>
                    )}
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {notification.content}
                  </p>

                  {/* Time */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Unread indicator */}
                {isUnread && (
                  <div className="shrink-0">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
