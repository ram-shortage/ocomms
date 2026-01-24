/**
 * Socket.IO event type definitions.
 * Shared between server and client for type safety.
 */

/**
 * Attachment interface for file attachments on messages.
 * FILE-04/FILE-05: Used for displaying attachments in message UI.
 */
export interface Attachment {
  id: string;
  originalName: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
}

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
    /** GUST-03: Whether author is a guest */
    isGuest?: boolean;
  };
  /** File attachments for this message (FILE-04/FILE-05) */
  attachments?: Attachment[];
  /** Link previews for this message (LINK-01) */
  linkPreviews?: Array<{
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
  }>;
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
  channelSlug?: string;
  conversationId: string | null;
  actorId: string | null;
  actorName: string | null;
  content: string;
  channelName?: string;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Reminder interface for reminder events
 * RMND-*: Reminder feature types
 */
export interface Reminder {
  id: string;
  messageId: string;
  note: string | null;
  remindAt: Date;
  status: "pending" | "fired" | "snoozed" | "completed" | "cancelled";
  recurringPattern: "daily" | "weekly" | null;
  message?: Message;
}

export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:deleted": (data: { messageId: string; deletedAt: Date }) => void;
  "message:replyCount": (data: { messageId: string; replyCount: number }) => void;
  "note:updated": (data: {
    channelId?: string;
    workspaceId?: string; // For personal notes (organizationId)
    version: number;
    updatedBy: string;
    updatedByName: string;
  }) => void;
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
  "unread:update": (data: {
    channelId?: string;
    conversationId?: string;
    unreadCount: number;
  }) => void;
  "workspace:unreadUpdate": (data: {
    workspaceId: string;
    unreadCount: number;
  }) => void;
  "notification:new": (notification: Notification) => void;
  "notification:read": (data: { notificationId: string }) => void;
  "notification:readAll": () => void;
  /** RMND-*: Reminder fired event */
  "reminder:fired": (data: {
    reminder: Reminder;
    message: Message;
  }) => void;
  /** RMND-*: Reminder status updated event */
  "reminder:updated": (data: {
    reminderId: string;
    status: Reminder["status"];
    snoozedUntil?: Date;
  }) => void;
  /** LINK-*: Link preview ready event - worker broadcasts when preview is fetched */
  "linkPreview:ready": (data: {
    messageId: string;
    previews: Array<{
      id: string;
      url: string;
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      siteName: string | null;
    }>;
  }) => void;
  /** LINK-06: User hides a preview on their own message */
  "linkPreview:hidden": (data: {
    messageId: string;
    previewId: string;
  }) => void;
  error: (data: { message: string; code?: string; retryAfter?: number }) => void;
  /** Emitted when socket has joined all rooms and is ready for messaging */
  ready: () => void;
  /** SEC2-16: Guest soft-locked disconnect notification */
  "guest:locked": (data: { reason: string; message: string }) => void;
  /** WS-10: Join request approved notification */
  "workspace:join-request-approved": (data: {
    requestId: string;
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
  }) => void;
  /** WS-11: Join request rejected notification */
  "workspace:join-request-rejected": (data: {
    requestId: string;
    workspaceId: string;
    workspaceName: string;
    reason?: string;
  }) => void;
}

export interface ClientToServerEvents {
  "message:send": (
    data: {
      targetId: string;
      targetType: "channel" | "dm";
      content: string;
      /** Attachment IDs to link to this message (FILE-08/FILE-09) */
      attachmentIds?: string[];
    },
    callback?: (response: { success: boolean; messageId?: string }) => void
  ) => void;
  "message:delete": (data: { messageId: string }) => void;
  "note:subscribe": (data: { channelId?: string; workspaceId?: string }) => void;
  "note:unsubscribe": (data: { channelId?: string; workspaceId?: string }) => void;
  "note:broadcast": (data: {
    channelId?: string;
    workspaceId?: string;
    version: number;
    userName: string;
  }) => void;
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
  /** Lazy-load older messages for infinite scroll */
  "message:getOlder": (
    data: {
      targetId: string;
      targetType: "channel" | "dm";
      cursor: number; // sequence number to load before
      limit?: number;
    },
    callback: (response: {
      success: boolean;
      messages?: Message[];
      hasMore?: boolean;
      nextCursor?: number;
      error?: string;
    }) => void
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
  "unread:markRead": (
    data: { channelId?: string; conversationId?: string },
    callback: (response: { success: boolean }) => void
  ) => void;
  "unread:markMessageUnread": (
    data: { messageId: string },
    callback: (response: { success: boolean }) => void
  ) => void;
  "unread:fetch": (
    data: { channelIds?: string[]; conversationIds?: string[] },
    callback: (response: {
      channels: Record<string, number>;
      conversations: Record<string, number>;
    }) => void
  ) => void;
  "workspace:fetchUnreads": (
    data: { workspaceIds: string[] },
    callback: (response: {
      counts: Record<string, number>;
    }) => void
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
