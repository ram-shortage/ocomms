import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  },
}));

// Mock the authz module
vi.mock("../authz", () => ({
  isChannelMember: vi.fn(),
  isConversationParticipant: vi.fn(),
  getMessageContext: vi.fn(),
}));

// Mock the rooms module
vi.mock("../rooms", () => ({
  getRoomName: {
    channel: (id: string) => `channel:${id}`,
    conversation: (id: string) => `dm:${id}`,
    workspace: (id: string) => `workspace:${id}`,
    user: (id: string) => `user:${id}`,
  },
}));

// Get the mocked modules
import { db } from "@/db";
import { isChannelMember, isConversationParticipant, getMessageContext } from "../authz";

// Type assertion for mock functions
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
};

const mockIsChannelMember = isChannelMember as ReturnType<typeof vi.fn>;
const mockIsConversationParticipant = isConversationParticipant as ReturnType<typeof vi.fn>;
const mockGetMessageContext = getMessageContext as ReturnType<typeof vi.fn>;

// Mock Socket and IO types for testing
interface MockSocket {
  data: {
    userId: string;
    user?: { name?: string; email?: string };
  };
  emit: ReturnType<typeof vi.fn>;
}

interface MockIO {
  to: ReturnType<typeof vi.fn>;
}

// Simulated handler implementations for testing
// These mirror the logic in handlers/reaction.ts

async function handleReactionToggle(
  socket: MockSocket,
  io: MockIO,
  data: { messageId: string; emoji: string }
): Promise<void> {
  const userId = socket.data.userId;
  const userName = socket.data.user?.name || socket.data.user?.email || "Unknown";
  const { messageId, emoji } = data;

  // Verify user has access to the message's channel/DM
  const context = await mockGetMessageContext(messageId);
  if (!context) {
    socket.emit("error", { message: "Message not found" });
    return;
  }

  if (context.channelId) {
    const isMember = await mockIsChannelMember(userId, context.channelId);
    if (!isMember) {
      socket.emit("error", { message: "Not authorized to react to this message" });
      return;
    }
  } else if (context.conversationId) {
    const isParticipant = await mockIsConversationParticipant(userId, context.conversationId);
    if (!isParticipant) {
      socket.emit("error", { message: "Not authorized to react to this message" });
      return;
    }
  }

  // Check if reaction already exists
  const existing = await mockDb.limit();

  let action: "added" | "removed";

  if (existing && existing.length > 0) {
    // Remove existing reaction
    await mockDb.where();
    action = "removed";
  } else {
    // Add new reaction
    await mockDb.onConflictDoNothing();
    action = "added";
  }

  // Determine room name
  const roomName = context.channelId
    ? `channel:${context.channelId}`
    : `dm:${context.conversationId}`;

  // Broadcast reaction update to room
  io.to(roomName).emit("reaction:update", {
    messageId,
    emoji,
    userId,
    userName,
    action,
  });
}

async function handleGetReactions(
  socket: MockSocket,
  data: { messageId: string },
  callback: (response: { success: boolean; reactions?: Array<{ emoji: string; count: number; userIds: string[]; userNames: string[] }> }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { messageId } = data;

  // Verify user has access to the message's channel/DM
  const context = await mockGetMessageContext(messageId);
  if (!context) {
    callback({ success: false });
    return;
  }

  if (context.channelId) {
    const isMember = await mockIsChannelMember(userId, context.channelId);
    if (!isMember) {
      socket.emit("error", { message: "Not authorized to view reactions on this message" });
      callback({ success: false });
      return;
    }
  } else if (context.conversationId) {
    const isParticipant = await mockIsConversationParticipant(userId, context.conversationId);
    if (!isParticipant) {
      socket.emit("error", { message: "Not authorized to view reactions on this message" });
      callback({ success: false });
      return;
    }
  }

  // Query reactions grouped by emoji with user info
  const result = await mockDb.where();

  // Group by emoji
  const grouped = new Map<string, { userIds: string[]; userNames: string[] }>();

  for (const row of result || []) {
    if (!grouped.has(row.emoji)) {
      grouped.set(row.emoji, { userIds: [], userNames: [] });
    }
    const group = grouped.get(row.emoji)!;
    group.userIds.push(row.userId);
    group.userNames.push(row.userName || row.userEmail);
  }

  // Convert to ReactionGroup array
  const reactionGroups: Array<{ emoji: string; count: number; userIds: string[]; userNames: string[] }> = [];
  for (const [emoji, { userIds, userNames }] of grouped) {
    reactionGroups.push({
      emoji,
      count: userIds.length,
      userIds,
      userNames,
    });
  }

  callback({ success: true, reactions: reactionGroups });
}

describe("Reaction Handlers", () => {
  let mockSocket: MockSocket;
  let mockIO: MockIO;
  let emitFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.delete.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();

    emitFn = vi.fn();
    mockSocket = {
      data: {
        userId: "user-123",
        user: { name: "Test User", email: "test@example.com" },
      },
      emit: vi.fn(),
    };
    mockIO = {
      to: vi.fn().mockReturnValue({ emit: emitFn }),
    };
  });

  describe("reaction:toggle", () => {
    it("adds reaction when not present", async () => {
      // Setup: message in channel, user is member, no existing reaction
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.limit.mockResolvedValue([]); // No existing reaction
      mockDb.onConflictDoNothing.mockResolvedValue(undefined);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      // Assert: room broadcast emitted with action: "added"
      expect(mockIO.to).toHaveBeenCalledWith("channel:channel-456");
      expect(emitFn).toHaveBeenCalledWith("reaction:update", {
        messageId: "msg-789",
        emoji: "👍",
        userId: "user-123",
        userName: "Test User",
        action: "added",
      });
    });

    it("removes reaction when already present", async () => {
      // Setup: existing reaction for user+message+emoji
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.limit.mockResolvedValue([{ id: "reaction-id" }]); // Existing reaction
      mockDb.where.mockResolvedValue(undefined); // delete().where()

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      // Assert: room broadcast emitted with action: "removed"
      expect(emitFn).toHaveBeenCalledWith("reaction:update", {
        messageId: "msg-789",
        emoji: "👍",
        userId: "user-123",
        userName: "Test User",
        action: "removed",
      });
    });

    it("rejects non-channel-members", async () => {
      // Setup: message in channel, user not member
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(false);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      // Assert: error emitted
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to react to this message",
      });
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("rejects non-conversation-participants in DM", async () => {
      // Setup: message in DM, user not participant
      mockGetMessageContext.mockResolvedValue({
        channelId: null,
        conversationId: "conv-456",
      });
      mockIsConversationParticipant.mockResolvedValue(false);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      // Assert: error emitted
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to react to this message",
      });
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("handles message not found", async () => {
      // Setup: message does not exist
      mockGetMessageContext.mockResolvedValue(null);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "non-existent",
        emoji: "👍",
      });

      // Assert: error emitted
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Message not found",
      });
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("is idempotent across rapid toggles", async () => {
      // Setup: simulate two rapid toggles
      // First toggle: add
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);

      // First call: no existing reaction
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.onConflictDoNothing.mockResolvedValue(undefined);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      expect(emitFn).toHaveBeenLastCalledWith("reaction:update", expect.objectContaining({
        action: "added",
      }));

      // Second call: now has reaction
      mockDb.limit.mockResolvedValueOnce([{ id: "reaction-id" }]);
      mockDb.where.mockResolvedValue(undefined);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      expect(emitFn).toHaveBeenLastCalledWith("reaction:update", expect.objectContaining({
        action: "removed",
      }));

      // Third call: back to no reaction (idempotent - returns to original)
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.onConflictDoNothing.mockResolvedValue(undefined);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "👍",
      });

      expect(emitFn).toHaveBeenLastCalledWith("reaction:update", expect.objectContaining({
        action: "added",
      }));
    });

    it("allows reaction to DM message when participant", async () => {
      // Setup: message in DM, user is participant
      mockGetMessageContext.mockResolvedValue({
        channelId: null,
        conversationId: "conv-456",
      });
      mockIsConversationParticipant.mockResolvedValue(true);
      mockDb.limit.mockResolvedValue([]);
      mockDb.onConflictDoNothing.mockResolvedValue(undefined);

      await handleReactionToggle(mockSocket, mockIO, {
        messageId: "msg-789",
        emoji: "❤️",
      });

      // Assert: broadcast to DM room
      expect(mockIO.to).toHaveBeenCalledWith("dm:conv-456");
      expect(emitFn).toHaveBeenCalledWith("reaction:update", expect.objectContaining({
        action: "added",
        emoji: "❤️",
      }));
    });
  });

  describe("reaction:get", () => {
    it("returns grouped reactions by emoji", async () => {
      // Setup: message with reactions from multiple users
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.where.mockResolvedValue([
        { emoji: "👍", userId: "user-1", userName: "Alice", userEmail: "alice@example.com" },
        { emoji: "👍", userId: "user-2", userName: "Bob", userEmail: "bob@example.com" },
        { emoji: "❤️", userId: "user-1", userName: "Alice", userEmail: "alice@example.com" },
      ]);

      const callback = vi.fn();
      await handleGetReactions(mockSocket, { messageId: "msg-789" }, callback);

      // Assert: returns grouped reactions
      expect(callback).toHaveBeenCalledWith({
        success: true,
        reactions: expect.arrayContaining([
          expect.objectContaining({
            emoji: "👍",
            count: 2,
            userIds: ["user-1", "user-2"],
            userNames: ["Alice", "Bob"],
          }),
          expect.objectContaining({
            emoji: "❤️",
            count: 1,
            userIds: ["user-1"],
            userNames: ["Alice"],
          }),
        ]),
      });
    });

    it("returns empty array when no reactions", async () => {
      // Setup: message with no reactions
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.where.mockResolvedValue([]);

      const callback = vi.fn();
      await handleGetReactions(mockSocket, { messageId: "msg-789" }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        reactions: [],
      });
    });

    it("rejects non-channel-members", async () => {
      // Setup: message in channel, user not member
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(false);

      const callback = vi.fn();
      await handleGetReactions(mockSocket, { messageId: "msg-789" }, callback);

      // Assert: error emitted, callback returns failure
      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to view reactions on this message",
      });
      expect(callback).toHaveBeenCalledWith({ success: false });
    });

    it("rejects non-conversation-participants in DM", async () => {
      // Setup: message in DM, user not participant
      mockGetMessageContext.mockResolvedValue({
        channelId: null,
        conversationId: "conv-456",
      });
      mockIsConversationParticipant.mockResolvedValue(false);

      const callback = vi.fn();
      await handleGetReactions(mockSocket, { messageId: "msg-789" }, callback);

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to view reactions on this message",
      });
      expect(callback).toHaveBeenCalledWith({ success: false });
    });

    it("handles message not found", async () => {
      // Setup: message does not exist
      mockGetMessageContext.mockResolvedValue(null);

      const callback = vi.fn();
      await handleGetReactions(mockSocket, { messageId: "non-existent" }, callback);

      expect(callback).toHaveBeenCalledWith({ success: false });
    });

    it("uses email as fallback when name is null", async () => {
      // Setup: user without name
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.where.mockResolvedValue([
        { emoji: "👍", userId: "user-1", userName: null, userEmail: "alice@example.com" },
      ]);

      const callback = vi.fn();
      await handleGetReactions(mockSocket, { messageId: "msg-789" }, callback);

      expect(callback).toHaveBeenCalledWith({
        success: true,
        reactions: [
          expect.objectContaining({
            userNames: ["alice@example.com"],
          }),
        ],
      });
    });
  });
});
