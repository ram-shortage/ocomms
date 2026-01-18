import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { messages, threadParticipants, users } from "@/db/schema";
import { eq, and, isNull, sql, max } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Message } from "@/lib/socket-events";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Handle thread:reply event.
 * Creates a reply to a parent message, preventing nested threading.
 */
async function handleThreadReply(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { parentId: string; content: string },
  callback?: (response: { success: boolean; messageId?: string }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { parentId, content } = data;

  try {
    // Get parent message and verify it exists and is not deleted
    const [parent] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, parentId), isNull(messages.deletedAt)))
      .limit(1);

    if (!parent) {
      socket.emit("error", { message: "Parent message not found" });
      callback?.({ success: false });
      return;
    }

    // Prevent nested threads: cannot reply to a reply
    if (parent.parentId !== null) {
      socket.emit("error", { message: "Cannot reply to a reply" });
      callback?.({ success: false });
      return;
    }

    // Determine which room the parent is in (channel or DM)
    const targetId = parent.channelId || parent.conversationId;
    const targetType = parent.channelId ? "channel" : "dm";

    if (!targetId) {
      socket.emit("error", { message: "Invalid parent message" });
      callback?.({ success: false });
      return;
    }

    // Get next sequence number for the channel/conversation
    const condition = targetType === "channel"
      ? eq(messages.channelId, targetId)
      : eq(messages.conversationId, targetId);

    const [maxSeq] = await db
      .select({ maxSequence: max(messages.sequence) })
      .from(messages)
      .where(condition);

    const sequence = (maxSeq?.maxSequence ?? 0) + 1;

    // Insert reply and update parent's replyCount atomically
    const [newMessage] = await db
      .insert(messages)
      .values({
        content,
        authorId: userId,
        channelId: parent.channelId,
        conversationId: parent.conversationId,
        parentId,
        sequence,
      })
      .returning();

    // Increment parent's replyCount
    await db
      .update(messages)
      .set({
        replyCount: sql`${messages.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, parentId));

    // Upsert thread participant for current user
    await db
      .insert(threadParticipants)
      .values({
        threadId: parentId,
        userId,
      })
      .onConflictDoUpdate({
        target: [threadParticipants.threadId, threadParticipants.userId],
        set: {
          lastReadAt: new Date(),
        },
      });

    // Get author info for broadcast
    const [author] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    const messageWithAuthor: Message = {
      id: newMessage.id,
      content: newMessage.content,
      authorId: newMessage.authorId,
      channelId: newMessage.channelId,
      conversationId: newMessage.conversationId,
      parentId: newMessage.parentId,
      replyCount: 0,
      sequence: newMessage.sequence,
      deletedAt: newMessage.deletedAt,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      author: author ? { id: author.id, name: author.name, email: author.email } : undefined,
    };

    // Broadcast to thread room
    io.to(getRoomName.thread(parentId)).emit("thread:newReply", messageWithAuthor);

    // Broadcast reply count update to channel/DM room
    const mainRoomName = targetType === "channel"
      ? getRoomName.channel(targetId)
      : getRoomName.conversation(targetId);

    // Get updated reply count
    const [updatedParent] = await db
      .select({ replyCount: messages.replyCount })
      .from(messages)
      .where(eq(messages.id, parentId));

    io.to(mainRoomName).emit("message:replyCount", {
      messageId: parentId,
      replyCount: updatedParent?.replyCount ?? 1,
    });

    // Acknowledge success
    callback?.({ success: true, messageId: newMessage.id });

    console.log(`[Thread] User ${userId} replied to ${parentId} with ${newMessage.id}`);
  } catch (error) {
    console.error("[Thread] Error creating reply:", error);
    socket.emit("error", { message: "Failed to create reply" });
    callback?.({ success: false });
  }
}

/**
 * Handle thread:join event.
 * Joins socket to thread room for real-time updates.
 */
function handleJoinThread(socket: SocketWithData, data: { threadId: string }): void {
  socket.join(getRoomName.thread(data.threadId));
  console.log(`[Thread] User ${socket.data.userId} joined thread: ${data.threadId}`);
}

/**
 * Handle thread:leave event.
 * Leaves socket from thread room.
 */
function handleLeaveThread(socket: SocketWithData, data: { threadId: string }): void {
  socket.leave(getRoomName.thread(data.threadId));
  console.log(`[Thread] User ${socket.data.userId} left thread: ${data.threadId}`);
}

/**
 * Handle thread:getReplies event.
 * Fetches all replies for a thread.
 */
async function handleGetReplies(
  socket: SocketWithData,
  data: { threadId: string },
  callback: (response: { success: boolean; replies?: Message[] }) => void
): Promise<void> {
  try {
    const replies = await db
      .select({
        id: messages.id,
        content: messages.content,
        authorId: messages.authorId,
        channelId: messages.channelId,
        conversationId: messages.conversationId,
        parentId: messages.parentId,
        replyCount: messages.replyCount,
        sequence: messages.sequence,
        deletedAt: messages.deletedAt,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.id))
      .where(and(eq(messages.parentId, data.threadId), isNull(messages.deletedAt)))
      .orderBy(messages.sequence);

    const formattedReplies: Message[] = replies.map((r) => ({
      id: r.id,
      content: r.content,
      authorId: r.authorId,
      channelId: r.channelId,
      conversationId: r.conversationId,
      parentId: r.parentId,
      replyCount: r.replyCount,
      sequence: r.sequence,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        id: r.authorId,
        name: r.authorName,
        email: r.authorEmail || "",
      },
    }));

    callback({ success: true, replies: formattedReplies });
  } catch (error) {
    console.error("[Thread] Error fetching replies:", error);
    callback({ success: false });
  }
}

/**
 * Register thread event handlers on socket.
 */
export function handleThreadEvents(socket: SocketWithData, io: SocketIOServer): void {
  socket.on("thread:reply", (data, callback) => {
    handleThreadReply(socket, io, data, callback);
  });

  socket.on("thread:join", (data) => {
    handleJoinThread(socket, data);
  });

  socket.on("thread:leave", (data) => {
    handleLeaveThread(socket, data);
  });

  socket.on("thread:getReplies", (data, callback) => {
    handleGetReplies(socket, data, callback);
  });
}
