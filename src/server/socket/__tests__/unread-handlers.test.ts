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
    onConflictDoUpdate: vi.fn(),
    query: {
      channelReadState: {
        findFirst: vi.fn(),
      },
      messages: {
        findFirst: vi.fn(),
      },
    },
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
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  query: {
    channelReadState: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    messages: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
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

// Mock Redis
interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
}

// Simulated unread count calculation
async function getUnreadCount(
  userId: string,
  channelId: string,
  redis: MockRedis | null,
  maxSequence: number,
  readState: { lastReadSequence: number; markedUnreadAtSequence?: number | null } | null
): Promise<number> {
  // Try Redis cache first
  if (redis) {
    const cached = await redis.get(`unread:${userId}:channel:${channelId}`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }
  }

  // Calculate effective read position
  let effectiveReadSeq = readState?.lastReadSequence ?? 0;
  if (readState?.markedUnreadAtSequence !== null && readState?.markedUnreadAtSequence !== undefined) {
    effectiveReadSeq = Math.min(effectiveReadSeq, readState.markedUnreadAtSequence - 1);
  }

  const unread = Math.max(0, maxSequence - effectiveReadSeq);

  // Cache result
  if (redis) {
    await redis.setex(`unread:${userId}:channel:${channelId}`, 60, unread.toString());
  }

  return unread;
}

// Simulated unread:fetch handler
async function handleUnreadFetch(
  userId: string,
  data: { channelIds?: string[]; conversationIds?: string[] },
  callback: (response: { channels: Record<string, number>; conversations: Record<string, number> }) => void,
  channelUnreadCounts: Record<string, number>,
  conversationUnreadCounts: Record<string, number>
): Promise<void> {
  try {
    const channels: Record<string, number> = {};
    const conversations: Record<string, number> = {};

    if (data.channelIds) {
      for (const channelId of data.channelIds) {
        const isMember = await mockIsChannelMember(userId, channelId);
        if (isMember) {
          channels[channelId] = channelUnreadCounts[channelId] ?? 0;
        }
        // Silently skip unauthorized channels
      }
    }

    if (data.conversationIds) {
      for (const conversationId of data.conversationIds) {
        const isParticipant = await mockIsConversationParticipant(userId, conversationId);
        if (isParticipant) {
          conversations[conversationId] = conversationUnreadCounts[conversationId] ?? 0;
        }
        // Silently skip unauthorized conversations
      }
    }

    callback({ channels, conversations });
  } catch {
    callback({ channels: {}, conversations: {} });
  }
}

// Simulated unread:markRead handler
async function handleUnreadMarkRead(
  socket: MockSocket,
  io: MockIO,
  data: { channelId?: string; conversationId?: string },
  callback: (response: { success: boolean }) => void,
  redis: MockRedis | null
): Promise<void> {
  const userId = socket.data.userId;

  try {
    if (data.channelId) {
      const isMember = await mockIsChannelMember(userId, data.channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to mark this channel as read" });
        callback({ success: false });
        return;
      }

      // Simulate marking as read
      await mockDb.onConflictDoUpdate();

      // Invalidate cache
      if (redis) {
        await redis.del(`unread:${userId}:channel:${data.channelId}`);
      }

      // Emit update
      io.to(`user:${userId}`).emit("unread:update", {
        channelId: data.channelId,
        unreadCount: 0,
      });
    } else if (data.conversationId) {
      const isParticipant = await mockIsConversationParticipant(userId, data.conversationId);
      if (!isParticipant) {
        socket.emit("error", { message: "Not authorized to mark this conversation as read" });
        callback({ success: false });
        return;
      }

      await mockDb.onConflictDoUpdate();

      if (redis) {
        await redis.del(`unread:${userId}:conv:${data.conversationId}`);
      }

      io.to(`user:${userId}`).emit("unread:update", {
        conversationId: data.conversationId,
        unreadCount: 0,
      });
    }

    callback({ success: true });
  } catch {
    callback({ success: false });
  }
}

// Simulated unread:markMessageUnread handler
async function handleUnreadMarkMessageUnread(
  socket: MockSocket,
  io: MockIO,
  data: { messageId: string },
  callback: (response: { success: boolean }) => void,
  redis: MockRedis | null,
  messageSequence: number,
  newUnreadCount: number
): Promise<void> {
  const userId = socket.data.userId;

  try {
    const context = await mockGetMessageContext(data.messageId);
    if (!context) {
      callback({ success: false });
      return;
    }

    if (context.channelId) {
      const isMember = await mockIsChannelMember(userId, context.channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to modify unread state" });
        callback({ success: false });
        return;
      }

      await mockDb.onConflictDoUpdate();

      if (redis) {
        await redis.del(`unread:${userId}:channel:${context.channelId}`);
      }

      io.to(`user:${userId}`).emit("unread:update", {
        channelId: context.channelId,
        unreadCount: newUnreadCount,
      });
    } else if (context.conversationId) {
      const isParticipant = await mockIsConversationParticipant(userId, context.conversationId);
      if (!isParticipant) {
        socket.emit("error", { message: "Not authorized to modify unread state" });
        callback({ success: false });
        return;
      }

      await mockDb.onConflictDoUpdate();

      if (redis) {
        await redis.del(`unread:${userId}:conv:${context.conversationId}`);
      }

      io.to(`user:${userId}`).emit("unread:update", {
        conversationId: context.conversationId,
        unreadCount: newUnreadCount,
      });
    }

    callback({ success: true });
  } catch {
    callback({ success: false });
  }
}

// Simulated notifyUnreadIncrement
async function notifyUnreadIncrement(
  io: MockIO,
  channelId: string,
  senderId: string,
  channelMembers: Array<{ userId: string }>,
  redis: MockRedis | null,
  getNewCount: (userId: string) => number
): Promise<void> {
  for (const member of channelMembers) {
    if (member.userId === senderId) continue;

    // Invalidate cache
    if (redis) {
      await redis.del(`unread:${member.userId}:channel:${channelId}`);
    }

    // Get new count and emit
    const count = getNewCount(member.userId);
    io.to(`user:${member.userId}`).emit("unread:update", {
      channelId,
      unreadCount: count,
    });
  }
}

describe("Unread Handlers", () => {
  let mockSocket: MockSocket;
  let mockIO: MockIO;
  let mockRedis: MockRedis;
  let emitFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();

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
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    };
  });

  describe("Unread count calculation", () => {
    it("returns cached unread count from Redis", async () => {
      mockRedis.get.mockResolvedValue("5");

      const count = await getUnreadCount("user-123", "channel-456", mockRedis, 50, null);

      expect(count).toBe(5);
      expect(mockRedis.get).toHaveBeenCalledWith("unread:user-123:channel:channel-456");
    });

    it("calculates unread from DB when cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);

      const count = await getUnreadCount("user-123", "channel-456", mockRedis, 50, {
        lastReadSequence: 40,
        markedUnreadAtSequence: null,
      });

      expect(count).toBe(10); // 50 - 40 = 10 unread
      expect(mockRedis.setex).toHaveBeenCalledWith("unread:user-123:channel:channel-456", 60, "10");
    });

    it("respects markedUnreadAtSequence", async () => {
      mockRedis.get.mockResolvedValue(null);

      const count = await getUnreadCount("user-123", "channel-456", mockRedis, 50, {
        lastReadSequence: 45, // User read up to 45
        markedUnreadAtSequence: 30, // But marked unread from 30
      });

      // Effective read = min(45, 30-1) = 29
      // Unread = 50 - 29 = 21
      expect(count).toBe(21);
    });

    it("returns 0 for channels with no unread", async () => {
      mockRedis.get.mockResolvedValue(null);

      const count = await getUnreadCount("user-123", "channel-456", mockRedis, 50, {
        lastReadSequence: 50, // Read all messages
        markedUnreadAtSequence: null,
      });

      expect(count).toBe(0);
    });

    it("works without Redis", async () => {
      const count = await getUnreadCount("user-123", "channel-456", null, 50, {
        lastReadSequence: 40,
        markedUnreadAtSequence: null,
      });

      expect(count).toBe(10);
    });

    it("handles no read state (never read)", async () => {
      mockRedis.get.mockResolvedValue(null);

      const count = await getUnreadCount("user-123", "channel-456", mockRedis, 50, null);

      // No read state = read sequence 0
      // Unread = 50 - 0 = 50
      expect(count).toBe(50);
    });
  });

  describe("unread:fetch", () => {
    it("returns unread counts per channel", async () => {
      // Setup: user is member of 3 channels with varying unread
      mockIsChannelMember.mockResolvedValue(true);

      const callback = vi.fn();
      await handleUnreadFetch(
        "user-123",
        { channelIds: ["ch1", "ch2", "ch3"] },
        callback,
        { ch1: 5, ch2: 0, ch3: 12 },
        {}
      );

      expect(callback).toHaveBeenCalledWith({
        channels: { ch1: 5, ch2: 0, ch3: 12 },
        conversations: {},
      });
    });

    it("returns unread counts per conversation", async () => {
      mockIsConversationParticipant.mockResolvedValue(true);

      const callback = vi.fn();
      await handleUnreadFetch(
        "user-123",
        { conversationIds: ["conv1", "conv2"] },
        callback,
        {},
        { conv1: 3, conv2: 7 }
      );

      expect(callback).toHaveBeenCalledWith({
        channels: {},
        conversations: { conv1: 3, conv2: 7 },
      });
    });

    it("only includes member channels", async () => {
      // Setup: user member of ch1, not ch2
      mockIsChannelMember.mockImplementation((_userId: string, channelId: string) =>
        Promise.resolve(channelId === "ch1")
      );

      const callback = vi.fn();
      await handleUnreadFetch(
        "user-123",
        { channelIds: ["ch1", "ch2"] },
        callback,
        { ch1: 5, ch2: 10 },
        {}
      );

      // Only ch1 should be in response
      expect(callback).toHaveBeenCalledWith({
        channels: { ch1: 5 }, // ch2 excluded
        conversations: {},
      });
    });

    it("silently excludes non-participant conversations", async () => {
      mockIsConversationParticipant.mockImplementation((_userId: string, convId: string) =>
        Promise.resolve(convId === "conv1")
      );

      const callback = vi.fn();
      await handleUnreadFetch(
        "user-123",
        { conversationIds: ["conv1", "conv2"] },
        callback,
        {},
        { conv1: 3, conv2: 10 }
      );

      expect(callback).toHaveBeenCalledWith({
        channels: {},
        conversations: { conv1: 3 }, // conv2 excluded
      });
    });

    it("returns empty objects when no ids provided", async () => {
      const callback = vi.fn();
      await handleUnreadFetch("user-123", {}, callback, {}, {});

      expect(callback).toHaveBeenCalledWith({
        channels: {},
        conversations: {},
      });
    });
  });

  describe("unread:markRead", () => {
    it("marks channel as read", async () => {
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      const callback = vi.fn();
      await handleUnreadMarkRead(
        mockSocket,
        mockIO,
        { channelId: "channel-456" },
        callback,
        mockRedis
      );

      // Assert: cache invalidated, update emitted, callback success
      expect(mockRedis.del).toHaveBeenCalledWith("unread:user-123:channel:channel-456");
      expect(mockIO.to).toHaveBeenCalledWith("user:user-123");
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        channelId: "channel-456",
        unreadCount: 0,
      });
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it("marks conversation as read", async () => {
      mockIsConversationParticipant.mockResolvedValue(true);
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      const callback = vi.fn();
      await handleUnreadMarkRead(
        mockSocket,
        mockIO,
        { conversationId: "conv-456" },
        callback,
        mockRedis
      );

      expect(mockRedis.del).toHaveBeenCalledWith("unread:user-123:conv:conv-456");
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        conversationId: "conv-456",
        unreadCount: 0,
      });
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it("rejects non-member for channel", async () => {
      mockIsChannelMember.mockResolvedValue(false);

      const callback = vi.fn();
      await handleUnreadMarkRead(
        mockSocket,
        mockIO,
        { channelId: "channel-456" },
        callback,
        mockRedis
      );

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to mark this channel as read",
      });
      expect(callback).toHaveBeenCalledWith({ success: false });
    });

    it("rejects non-participant for conversation", async () => {
      mockIsConversationParticipant.mockResolvedValue(false);

      const callback = vi.fn();
      await handleUnreadMarkRead(
        mockSocket,
        mockIO,
        { conversationId: "conv-456" },
        callback,
        mockRedis
      );

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to mark this conversation as read",
      });
      expect(callback).toHaveBeenCalledWith({ success: false });
    });
  });

  describe("unread:markMessageUnread", () => {
    it("marks channel as unread from message sequence", async () => {
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      const callback = vi.fn();
      await handleUnreadMarkMessageUnread(
        mockSocket,
        mockIO,
        { messageId: "msg-789" },
        callback,
        mockRedis,
        30, // message sequence
        20 // new unread count
      );

      expect(mockRedis.del).toHaveBeenCalledWith("unread:user-123:channel:channel-456");
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        channelId: "channel-456",
        unreadCount: 20,
      });
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it("marks conversation as unread from message", async () => {
      mockGetMessageContext.mockResolvedValue({
        channelId: null,
        conversationId: "conv-456",
      });
      mockIsConversationParticipant.mockResolvedValue(true);
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      const callback = vi.fn();
      await handleUnreadMarkMessageUnread(
        mockSocket,
        mockIO,
        { messageId: "msg-789" },
        callback,
        mockRedis,
        10,
        5
      );

      expect(mockRedis.del).toHaveBeenCalledWith("unread:user-123:conv:conv-456");
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        conversationId: "conv-456",
        unreadCount: 5,
      });
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it("rejects non-member for channel message", async () => {
      mockGetMessageContext.mockResolvedValue({
        channelId: "channel-456",
        conversationId: null,
      });
      mockIsChannelMember.mockResolvedValue(false);

      const callback = vi.fn();
      await handleUnreadMarkMessageUnread(
        mockSocket,
        mockIO,
        { messageId: "msg-789" },
        callback,
        mockRedis,
        30,
        20
      );

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Not authorized to modify unread state",
      });
      expect(callback).toHaveBeenCalledWith({ success: false });
    });

    it("handles message not found", async () => {
      mockGetMessageContext.mockResolvedValue(null);

      const callback = vi.fn();
      await handleUnreadMarkMessageUnread(
        mockSocket,
        mockIO,
        { messageId: "non-existent" },
        callback,
        mockRedis,
        0,
        0
      );

      expect(callback).toHaveBeenCalledWith({ success: false });
    });
  });

  describe("Cache invalidation", () => {
    it("new message increments unread for other members", async () => {
      // Setup: channel with alice and bob, both at sequence 10
      // alice sends message (sequence 11)
      const channelMembers = [
        { userId: "alice" }, // sender
        { userId: "bob" },
      ];

      // Function to get new count (bob should have 1 unread, alice has 0)
      const getNewCount = (userId: string) => (userId === "bob" ? 1 : 0);

      await notifyUnreadIncrement(
        mockIO,
        "channel-456",
        "alice",
        channelMembers,
        mockRedis,
        getNewCount
      );

      // Assert: bob's cache invalidated and update emitted
      expect(mockRedis.del).toHaveBeenCalledWith("unread:bob:channel:channel-456");
      expect(mockIO.to).toHaveBeenCalledWith("user:bob");
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        channelId: "channel-456",
        unreadCount: 1,
      });

      // Alice (sender) should NOT receive unread update
      expect(mockRedis.del).not.toHaveBeenCalledWith("unread:alice:channel:channel-456");
    });

    it("does not notify sender of their own message", async () => {
      const channelMembers = [
        { userId: "alice" },
        { userId: "bob" },
        { userId: "charlie" },
      ];

      await notifyUnreadIncrement(
        mockIO,
        "channel-456",
        "alice",
        channelMembers,
        mockRedis,
        (_userId) => 1
      );

      // Only bob and charlie should be notified
      expect(mockIO.to).toHaveBeenCalledTimes(2);
      expect(mockIO.to).toHaveBeenCalledWith("user:bob");
      expect(mockIO.to).toHaveBeenCalledWith("user:charlie");
      expect(mockIO.to).not.toHaveBeenCalledWith("user:alice");
    });

    it("mark read clears unread count", async () => {
      mockIsChannelMember.mockResolvedValue(true);
      mockDb.onConflictDoUpdate.mockResolvedValue(undefined);

      const callback = vi.fn();
      await handleUnreadMarkRead(
        mockSocket,
        mockIO,
        { channelId: "channel-456" },
        callback,
        mockRedis
      );

      // Assert: unread:update emitted with count 0
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        channelId: "channel-456",
        unreadCount: 0,
      });
    });

    it("works without Redis", async () => {
      const channelMembers = [{ userId: "alice" }, { userId: "bob" }];

      await notifyUnreadIncrement(
        mockIO,
        "channel-456",
        "alice",
        channelMembers,
        null, // No Redis
        (_userId) => 1
      );

      // Should still emit update
      expect(mockIO.to).toHaveBeenCalledWith("user:bob");
      expect(emitFn).toHaveBeenCalledWith("unread:update", {
        channelId: "channel-456",
        unreadCount: 1,
      });
    });
  });
});
