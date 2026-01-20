"use client";

import { useState, useEffect, useCallback } from "react";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Clock, Edit2, X, Send, Trash2, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getScheduledMessages,
  cancelScheduledMessage,
  sendScheduledMessageNow,
} from "@/lib/actions/scheduled-message";
import { ScheduledMessageEditDialog } from "./scheduled-message-edit-dialog";
import { cn } from "@/lib/utils";

interface ScheduledMessage {
  id: string;
  content: string;
  scheduledFor: Date;
  channelId: string | null;
  conversationId: string | null;
  channel?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  conversation?: {
    id: string;
    participants: Array<{
      user: {
        id: string;
        name: string | null;
        email: string;
      };
    }>;
  } | null;
}

/**
 * List of pending scheduled messages for the current user.
 * Displays message preview, scheduled time, and destination with actions.
 */
export function ScheduledMessagesList() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getScheduledMessages();
      // Convert date strings to Date objects
      setMessages(
        data.map((m) => ({
          ...m,
          scheduledFor: new Date(m.scheduledFor),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scheduled messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleCancel = async (id: string) => {
    try {
      setActionPending(id);
      await cancelScheduledMessage(id);
      // Remove from local state
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel message");
    } finally {
      setActionPending(null);
    }
  };

  const handleSendNow = async (id: string) => {
    try {
      setActionPending(id);
      await sendScheduledMessageNow(id);
      // Remove from local state (will be sent immediately)
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setActionPending(null);
    }
  };

  const handleEditComplete = () => {
    setEditingMessage(null);
    loadMessages(); // Reload to get updated data
  };

  // Format scheduled time for display
  const formatScheduledTime = (date: Date) => {
    if (isToday(date)) {
      return `Today at ${format(date, "h:mm a")}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, "h:mm a")}`;
    }
    if (isThisWeek(date)) {
      return `${format(date, "EEEE")} at ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d 'at' h:mm a");
  };

  // Get destination label
  const getDestinationLabel = (msg: ScheduledMessage) => {
    if (msg.channel) {
      return `#${msg.channel.name}`;
    }
    if (msg.conversation?.participants) {
      // Show other participants' names (assuming current user is filtered out on server)
      const names = msg.conversation.participants
        .map((p) => p.user.name || p.user.email)
        .slice(0, 2);
      if (names.length === 0) return "Direct message";
      if (names.length === 1) return names[0];
      return `${names[0]} +${msg.conversation.participants.length - 1}`;
    }
    return "Unknown";
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={loadMessages}>
          Retry
        </Button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">No scheduled messages</p>
        <p className="text-xs text-muted-foreground mt-1">
          Schedule a message from the compose area
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {messages.map((msg) => (
        <div key={msg.id} className="p-4 hover:bg-muted/30 transition-colors">
          {/* Message content preview */}
          <p className="text-sm line-clamp-2 mb-2">{msg.content}</p>

          {/* Metadata row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatScheduledTime(msg.scheduledFor)}</span>
            <span className="text-muted-foreground/50">|</span>
            {msg.channel ? (
              <>
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{getDestinationLabel(msg)}</span>
              </>
            ) : (
              <>
                <User className="h-3.5 w-3.5" />
                <span>{getDestinationLabel(msg)}</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditingMessage(msg)}
              disabled={actionPending === msg.id}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleSendNow(msg.id)}
              disabled={actionPending === msg.id}
            >
              <Send className="h-3 w-3 mr-1" />
              Send now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleCancel(msg.id)}
              disabled={actionPending === msg.id}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ))}

      {/* Edit dialog */}
      {editingMessage && (
        <ScheduledMessageEditDialog
          message={editingMessage}
          open={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          onSave={handleEditComplete}
        />
      )}
    </div>
  );
}
