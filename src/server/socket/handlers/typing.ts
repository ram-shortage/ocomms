import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { getRoomName } from "../rooms";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/** Track active typing per socket (for cleanup on disconnect) */
interface TypingState {
  targetId: string;
  targetType: "channel" | "dm";
}

/**
 * Handle typing indicator events for a connected socket.
 * Broadcasts typing:update to channel/dm rooms when users start/stop typing.
 */
export function handleTypingEvents(socket: TypedSocket, io: SocketIOServer): void {
  const userId = socket.data.userId;
  const userName = socket.data.user.name || socket.data.user.email;

  // Track current typing state for this socket (for disconnect cleanup)
  let activeTyping: TypingState | null = null;

  // Handle typing:start - broadcast to room except sender
  socket.on("typing:start", (data) => {
    const { targetId, targetType } = data;

    // Update active typing state
    activeTyping = { targetId, targetType };

    const roomName = targetType === "channel"
      ? getRoomName.channel(targetId)
      : getRoomName.conversation(targetId);

    // Broadcast to room except sender
    socket.to(roomName).emit("typing:update", {
      userId,
      userName,
      targetId,
      isTyping: true,
    });
  });

  // Handle typing:stop - broadcast to room except sender
  socket.on("typing:stop", (data) => {
    const { targetId, targetType } = data;

    // Clear active typing state
    activeTyping = null;

    const roomName = targetType === "channel"
      ? getRoomName.channel(targetId)
      : getRoomName.conversation(targetId);

    // Broadcast to room except sender
    socket.to(roomName).emit("typing:update", {
      userId,
      userName,
      targetId,
      isTyping: false,
    });
  });

  // Clean up on disconnect - broadcast typing:stop if user was typing
  socket.on("disconnect", () => {
    if (activeTyping) {
      const { targetId, targetType } = activeTyping;
      const roomName = targetType === "channel"
        ? getRoomName.channel(targetId)
        : getRoomName.conversation(targetId);

      // Broadcast typing stopped to room
      io.to(roomName).emit("typing:update", {
        userId,
        userName,
        targetId,
        isTyping: false,
      });
    }
  });
}
