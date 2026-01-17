import type { Socket } from "socket.io";
import { auth } from "@/lib/auth";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Socket.IO authentication middleware.
 * Validates better-auth session from cookies and attaches user to socket.data.
 */
export async function authMiddleware(
  socket: SocketWithData,
  next: (err?: Error) => void
) {
  try {
    // Extract cookies from handshake headers
    const cookies = socket.handshake.headers.cookie;
    if (!cookies) {
      return next(new Error("No session cookie"));
    }

    // Validate session with better-auth
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookies }),
    });

    if (!session) {
      return next(new Error("Invalid session"));
    }

    // Attach user info to socket for later use
    socket.data.userId = session.user.id;
    socket.data.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };

    next();
  } catch (error) {
    console.error("[Socket.IO] Auth middleware error:", error);
    next(new Error("Authentication failed"));
  }
}
