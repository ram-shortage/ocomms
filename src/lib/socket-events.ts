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

export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:deleted": (data: { messageId: string; deletedAt: Date }) => void;
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
  "room:join": (data: { roomId: string; roomType: "channel" | "dm" }) => void;
  "room:leave": (data: { roomId: string; roomType: "channel" | "dm" }) => void;
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
