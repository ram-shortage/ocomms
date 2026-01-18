"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import { getSocket } from "@/lib/socket-client";
import type { Notification } from "@/lib/socket-events";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  workspaceSlug: string;
}

export function NotificationBell({ workspaceSlug }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [animate, setAnimate] = useState(false);

  // Fetch initial notifications on mount
  useEffect(() => {
    const socket = getSocket();

    // Fetch notifications
    socket.emit("notification:fetch", { limit: 50 }, (response) => {
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    });
  }, []);

  // Listen for socket events
  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Trigger animation
      setAnimate(true);
      setTimeout(() => setAnimate(false), 500);
    };

    const handleNotificationRead = ({ notificationId }: { notificationId: string }) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleReadAll = () => {
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date() }))
      );
      setUnreadCount(0);
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("notification:read", handleNotificationRead);
    socket.on("notification:readAll", handleReadAll);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:read", handleNotificationRead);
      socket.off("notification:readAll", handleReadAll);
    };
  }, []);

  const handleMarkRead = useCallback((notificationId: string) => {
    const socket = getSocket();
    socket.emit("notification:markRead", { notificationId });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    const socket = getSocket();
    socket.emit("notification:markAllRead");
  }, []);

  const handleNavigate = useCallback(
    (notification: Notification) => {
      // Close popover
      setOpen(false);

      // Navigate to message location
      if (notification.channelId && notification.channelName) {
        // Note: We'd need channel slug here. For now, we can use a channel lookup
        // This is a simplification - in production you'd want to resolve the slug
        // For now, just close the popover. Full navigation would require more context.
      }
    },
    []
  );

  // Format badge count
  const badgeText = unreadCount > 99 ? "99+" : unreadCount.toString();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center px-1",
                animate && "animate-pulse"
              )}
            >
              {badgeText}
            </span>
          )}
          <span className="sr-only">
            {unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
        </div>
        <NotificationList
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          onNavigate={handleNavigate}
        />
      </PopoverContent>
    </Popover>
  );
}
