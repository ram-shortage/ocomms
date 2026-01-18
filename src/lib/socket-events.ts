/**
 * Socket.IO event type definitions.
 * Shared between server and client for type safety.
 */

export interface Message {
  id: string;
  content: string;
  authorId: string;
  channelId?: string | null;
  conversationId?: string | null;
  parentId?: string | null;
  replyCount?: number;
  sequence: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
}

export interface Notification {
  id: string;
  type: "mention" | "channel" | "here" | "thread_reply";
  messageId: string | null;
  channelId: string | null;
  conversationId: string | null;
  actorId: string | null;
  actorName: string | null;
  content: string;
  channelName?: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:deleted": (data: { messageId: string; deletedAt: Date }) => void;
  "message:replyCount": (data: { messageId: string; replyCount: number }) => void;
  "typing:update": (data: {
    userId: string;
    userName: string;
    targetId: string;
    isTyping: boolean;
  }) => void;
  "presence:update": (data: {
    userId: string;
    status: "active" | "away" | "offline";
  }) => void;
  "reaction:update": (data: {
    messageId: string;
    emoji: string;
    userId: string;
    userName: string;
    action: "added" | "removed";
  }) => void;
  "thread:newReply": (data: Message) => void;
  "notification:new": (notification: Notification) => void;
  "notification:read": (data: { notificationId: string }) => void;
  "notification:readAll": () => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "message:send": (
    data: { targetId: string; targetType: "channel" | "dm"; content: string },
    callback?: (response: { success: boolean; messageId?: string }) => void
  ) => void;
  "message:delete": (data: { messageId: string }) => void;
  "typing:start": (data: { targetId: string; targetType: "channel" | "dm" }) => void;
  "typing:stop": (data: { targetId: string; targetType: "channel" | "dm" }) => void;
  "presence:setAway": () => void;
  "presence:setActive": () => void;
  "presence:fetch": (
    data: { workspaceId: string; userIds: string[] },
    callback: (response: Record<string, "active" | "away" | "offline">) => void
  ) => void;
  "reaction:toggle": (data: { messageId: string; emoji: string }) => void;
  "reaction:get": (
    data: { messageId: string },
    callback: (response: { success: boolean; reactions?: ReactionGroup[] }) => void
  ) => void;
  "thread:reply": (
    data: { parentId: string; content: string },
    callback?: (response: { success: boolean; messageId?: string }) => void
  ) => void;
  "thread:join": (data: { threadId: string }) => void;
  "thread:leave": (data: { threadId: string }) => void;
  "thread:getReplies": (
    data: { threadId: string },
    callback: (response: { success: boolean; replies?: Message[] }) => void
  ) => void;
  "room:join": (data: { roomId: string; roomType: "channel" | "dm" }) => void;
  "room:leave": (data: { roomId: string; roomType: "channel" | "dm" }) => void;
  "workspace:join": (data: { workspaceId: string }) => void;
  "notification:markRead": (data: { notificationId: string }) => void;
  "notification:markAllRead": () => void;
  "notification:fetch": (
    data: { limit?: number },
    callback: (response: { notifications: Notification[]; unreadCount: number }) => void
  ) => void;
}

export interface SocketData {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  workspaceId?: string;
}
