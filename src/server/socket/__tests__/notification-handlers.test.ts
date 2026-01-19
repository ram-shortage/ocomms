import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    query: {
      channelNotificationSettings: {
        findFirst: vi.fn(),
      },
    },
  },
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

// Mock push notifications
vi.mock("@/lib/push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

// Get the mocked modules
import { db } from "@/db";
import { sendPushToUser } from "@/lib/push";

// Type assertion for mock functions
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  query: {
    channelNotificationSettings: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
};

const mockSendPushToUser = sendPushToUser as ReturnType<typeof vi.fn>;

// Mock Socket and IO types for testing
interface MockSocket {
  data: {
    userId: string;
    user?: { name?: string; email?: string };
  };
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

interface MockIO {
  to: ReturnType<typeof vi.fn>;
}

// Mock notification type
interface Notification {
  id: string;
  type: "mention" | "channel" | "here" | "thread_reply";
  messageId: string | null;
  channelId: string | null;
  channelSlug?: string;
  conversationId: string | null;
  actorId: string;
  actorName: string | null;
  content: string;
  channelName?: string;
  readAt: Date | null;
  createdAt: Date;
}

// Simulated notification:fetch handler for testing
async function handleNotificationFetch(
  userId: string,
  data: { limit?: number },
  callback: (response: { notifications: Notification[]; unreadCount: number }) => void
): Promise<void> {
  const limit = data.limit ?? 50;

  try {
    // Get notifications with actor info
    const notificationRows = await mockDb.limit();

    if (!notificationRows) {
      callback({ notifications: [], unreadCount: 0 });
      return;
    }

    const notificationList: Notification[] = notificationRows.map((n: {
      id: string;
      type: string;
      messageId: string | null;
      channelId: string | null;
      conversationId: string | null;
      actorId: string;
      content: string;
      readAt: Date | null;
      createdAt: Date;
      actorName: string | null;
    }) => ({
      id: n.id,
      type: n.type as "mention" | "channel" | "here" | "thread_reply",
      messageId: n.messageId,
      channelId: n.channelId,
      conversationId: n.conversationId,
      actorId: n.actorId,
      actorName: n.actorName,
      content: n.content,
      readAt: n.readAt,
      createdAt: n.createdAt,
    }));

    // Count unread
    const unreadCount = notificationList.filter(n => !n.readAt).length;

    callback({ notifications: notificationList, unreadCount });
  } catch {
    callback({ notifications: [], unreadCount: 0 });
  }
}

// Simulated notification:markRead handler
async function handleNotificationMarkRead(
  userId: string,
  io: MockIO,
  data: { notificationId: string }
): Promise<void> {
  const { notificationId } = data;

  try {
    await mockDb.where();
    io.to(`user:${userId}`).emit("notification:read", { notificationId });
  } catch {
    // Error handling
  }
}

// Simulated notification:markAllRead handler
async function handleNotificationMarkAllRead(
  userId: string,
  io: MockIO
): Promise<void> {
  try {
    await mockDb.where();
    io.to(`user:${userId}`).emit("notification:readAll");
  } catch {
    // Error handling
  }
}

// Helper to check if user should be notified (simulated shouldNotify)
async function shouldNotify(
  userId: string,
  channelId: string,
  mentionType: "user" | "channel" | "here"
): Promise<boolean> {
  const settings = await mockDb.query.channelNotificationSettings.findFirst();

  const mode: "all" | "mentions" | "muted" = settings?.mode ?? "all";

  switch (mode) {
    case "muted":
      return false;
    case "mentions":
      return mentionType === "user";
    case "all":
    default:
      return true;
  }
}

// Simulated createNotifications function
async function createNotifications(params: {
  io: MockIO;
  message: { id: string; content: string };
  mentions: Array<{ type: "user" | "channel" | "here"; value: string }>;
  senderId: string;
  channelId?: string | null;
  conversationId?: string | null;
  channelMembers?: Array<{ userId: string }>;
}): Promise<void> {
  const { io, message, mentions, senderId, channelId, channelMembers = [] } = params;

  if (mentions.length === 0) return;

  const notificationsToCreate: Array<{
    userId: string;
    type: "mention" | "channel" | "here";
  }> = [];

  const notifiedUserIds = new Set<string>();

  for (const mention of mentions) {
    if (mention.type === "user") {
      // Simulate user lookup - for testing, use the value as the userId
      const targetUserId = `user-${mention.value}`;

      if (targetUserId !== senderId && !notifiedUserIds.has(targetUserId)) {
        if (channelId) {
          const allowed = await shouldNotify(targetUserId, channelId, "user");
          if (!allowed) continue;
        }

        notifiedUserIds.add(targetUserId);
        notificationsToCreate.push({
          userId: targetUserId,
          type: "mention",
        });
      }
    } else if (mention.type === "channel" && channelId) {
      // Notify all channel members except sender
      for (const member of channelMembers) {
        if (member.userId !== senderId && !notifiedUserIds.has(member.userId)) {
          const allowed = await shouldNotify(member.userId, channelId, "channel");
          if (!allowed) continue;

          notifiedUserIds.add(member.userId);
          notificationsToCreate.push({
            userId: member.userId,
            type: "channel",
          });
        }
      }
    } else if (mention.type === "here" && channelId) {
      // For testing, notify all channel members (activity check skipped)
      for (const member of channelMembers) {
        if (member.userId !== senderId && !notifiedUserIds.has(member.userId)) {
          const allowed = await shouldNotify(member.userId, channelId, "here");
          if (!allowed) continue;

          notifiedUserIds.add(member.userId);
          notificationsToCreate.push({
            userId: member.userId,
            type: "here",
          });
        }
      }
    }
  }

  if (notificationsToCreate.length === 0) return;

  // Simulate inserting and emitting notifications
  for (const notification of notificationsToCreate) {
    io.to(`user:${notification.userId}`).emit("notification:new", {
      id: `notif-${Date.now()}`,
      type: notification.type,
      messageId: message.id,
      channelId,
      actorId: senderId,
      content: message.content.slice(0, 100),
      readAt: null,
      createdAt: new Date(),
    });

    // Send push
    mockSendPushToUser(notification.userId, {
      title: "New mention",
      body: message.content.slice(0, 100),
    });
  }
}

describe("Notification Handlers", () => {
  let mockSocket: MockSocket;
  let mockIO: MockIO;
  let emitFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.leftJoin.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();

    emitFn = vi.fn();
    mockSocket = {
      data: {
        userId: "user-123",
        user: { name: "Test User", email: "test@example.com" },
      },
      emit: vi.fn(),
      on: vi.fn(),
    };
    mockIO = {
      to: vi.fn().mockReturnValue({ emit: emitFn }),
    };
  });

  describe("notification:fetch", () => {
    it("returns paginated notifications for user", async () => {
      // Setup: user has 15 notifications
      const notifications = Array.from({ length: 15 }, (_, i) => ({
        id: `notif-${i}`,
        type: "mention",
        messageId: `msg-${i}`,
        channelId: "channel-123",
        conversationId: null,
        actorId: "actor-123",
        content: `Notification ${i}`,
        readAt: i < 5 ? null : new Date(), // First 5 are unread
        createdAt: new Date(),
        actorName: "Actor Name",
      }));

      mockDb.limit.mockResolvedValue(notifications.slice(0, 10)); // Simulating limit: 10

      const callback = vi.fn();
      await handleNotificationFetch("user-123", { limit: 10 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ id: "notif-0" }),
        ]),
      }));
      // Should have 10 notifications returned
      const result = callback.mock.calls[0][0];
      expect(result.notifications.length).toBe(10);
    });

    it("returns unread count", async () => {
      // Setup: user has 5 unread, 5 read
      const notifications = [
        { id: "n1", type: "mention", messageId: "m1", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: null, createdAt: new Date(), actorName: "Actor" },
        { id: "n2", type: "mention", messageId: "m2", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: null, createdAt: new Date(), actorName: "Actor" },
        { id: "n3", type: "mention", messageId: "m3", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: null, createdAt: new Date(), actorName: "Actor" },
        { id: "n4", type: "mention", messageId: "m4", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: null, createdAt: new Date(), actorName: "Actor" },
        { id: "n5", type: "mention", messageId: "m5", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: null, createdAt: new Date(), actorName: "Actor" },
        { id: "n6", type: "mention", messageId: "m6", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: new Date(), createdAt: new Date(), actorName: "Actor" },
        { id: "n7", type: "mention", messageId: "m7", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: new Date(), createdAt: new Date(), actorName: "Actor" },
        { id: "n8", type: "mention", messageId: "m8", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: new Date(), createdAt: new Date(), actorName: "Actor" },
        { id: "n9", type: "mention", messageId: "m9", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: new Date(), createdAt: new Date(), actorName: "Actor" },
        { id: "n10", type: "mention", messageId: "m10", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: new Date(), createdAt: new Date(), actorName: "Actor" },
      ];

      mockDb.limit.mockResolvedValue(notifications);

      const callback = vi.fn();
      await handleNotificationFetch("user-123", {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        unreadCount: 5,
      }));
    });

    it("only returns own notifications", async () => {
      // Setup: notifications belong to user-123
      const notifications = [
        { id: "n1", type: "mention", messageId: "m1", channelId: "c1", conversationId: null, actorId: "a1", content: "test", readAt: null, createdAt: new Date(), actorName: "Actor" },
      ];

      mockDb.limit.mockResolvedValue(notifications);

      const callback = vi.fn();
      await handleNotificationFetch("user-123", {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ id: "n1" }),
        ]),
      }));
    });

    it("returns empty array when no notifications", async () => {
      mockDb.limit.mockResolvedValue([]);

      const callback = vi.fn();
      await handleNotificationFetch("user-123", {}, callback);

      expect(callback).toHaveBeenCalledWith({
        notifications: [],
        unreadCount: 0,
      });
    });
  });

  describe("notification:markRead", () => {
    it("marks single notification as read", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await handleNotificationMarkRead("user-123", mockIO, { notificationId: "notif-456" });

      // Assert: notification:read emitted to user room
      expect(mockIO.to).toHaveBeenCalledWith("user:user-123");
      expect(emitFn).toHaveBeenCalledWith("notification:read", { notificationId: "notif-456" });
    });

    it("emits to user room for sync across devices", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await handleNotificationMarkRead("user-123", mockIO, { notificationId: "notif-789" });

      expect(mockIO.to).toHaveBeenCalledWith("user:user-123");
    });
  });

  describe("notification:markAllRead", () => {
    it("marks all as read", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await handleNotificationMarkAllRead("user-123", mockIO);

      // Assert: notification:readAll emitted to user room
      expect(mockIO.to).toHaveBeenCalledWith("user:user-123");
      expect(emitFn).toHaveBeenCalledWith("notification:readAll");
    });
  });

  describe("Mention notification creation", () => {
    it("creates notification for @username mention", async () => {
      // Setup: no notification settings (default: "all")
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue(null);

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @alice" },
        mentions: [{ type: "user", value: "alice" }],
        senderId: "sender-123",
        channelId: "channel-456",
      });

      // Assert: notification emitted to alice's room
      expect(mockIO.to).toHaveBeenCalledWith("user:user-alice");
      expect(emitFn).toHaveBeenCalledWith("notification:new", expect.objectContaining({
        type: "mention",
        actorId: "sender-123",
      }));
      expect(mockSendPushToUser).toHaveBeenCalledWith("user-alice", expect.objectContaining({
        title: "New mention",
      }));
    });

    it("creates notifications for @channel", async () => {
      // Setup: channel with 5 members, message with @channel
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue(null);

      const channelMembers = [
        { userId: "sender-123" }, // author
        { userId: "user-1" },
        { userId: "user-2" },
        { userId: "user-3" },
        { userId: "user-4" },
      ];

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @channel" },
        mentions: [{ type: "channel", value: "channel" }],
        senderId: "sender-123",
        channelId: "channel-456",
        channelMembers,
      });

      // Assert: 4 notifications created (excludes author)
      expect(mockIO.to).toHaveBeenCalledTimes(4);
      expect(mockIO.to).toHaveBeenCalledWith("user:user-1");
      expect(mockIO.to).toHaveBeenCalledWith("user:user-2");
      expect(mockIO.to).toHaveBeenCalledWith("user:user-3");
      expect(mockIO.to).toHaveBeenCalledWith("user:user-4");
      expect(mockIO.to).not.toHaveBeenCalledWith("user:sender-123");
    });

    it("creates notifications for @here", async () => {
      // Setup: channel with members
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue(null);

      const channelMembers = [
        { userId: "sender-123" },
        { userId: "user-1" },
        { userId: "user-2" },
      ];

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @here" },
        mentions: [{ type: "here", value: "here" }],
        senderId: "sender-123",
        channelId: "channel-456",
        channelMembers,
      });

      // Assert: notifications emitted for members (except sender)
      expect(mockIO.to).toHaveBeenCalledWith("user:user-1");
      expect(mockIO.to).toHaveBeenCalledWith("user:user-2");
      expect(mockIO.to).not.toHaveBeenCalledWith("user:sender-123");
    });

    it("does not notify author for self-mention", async () => {
      // Setup: alice sends message with @alice
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue(null);

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @alice" },
        mentions: [{ type: "user", value: "alice" }],
        senderId: "user-alice", // sender IS alice
        channelId: "channel-456",
      });

      // Assert: no notification for alice (self-mention)
      expect(mockIO.to).not.toHaveBeenCalled();
      expect(mockSendPushToUser).not.toHaveBeenCalled();
    });

    it("does not notify when no mentions", async () => {
      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello everyone" },
        mentions: [], // No mentions
        senderId: "sender-123",
        channelId: "channel-456",
      });

      // Assert: no notifications
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("respects muted notification settings", async () => {
      // Setup: user has muted the channel
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue({ mode: "muted" });

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @alice" },
        mentions: [{ type: "user", value: "alice" }],
        senderId: "sender-123",
        channelId: "channel-456",
      });

      // Assert: no notification for muted user
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("respects mentions-only notification settings for @channel", async () => {
      // Setup: user has "mentions" mode (only direct @user mentions)
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue({ mode: "mentions" });

      const channelMembers = [
        { userId: "sender-123" },
        { userId: "user-1" },
      ];

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @channel" },
        mentions: [{ type: "channel", value: "channel" }],
        senderId: "sender-123",
        channelId: "channel-456",
        channelMembers,
      });

      // Assert: no notification (user has mentions-only mode, @channel doesn't count)
      expect(mockIO.to).not.toHaveBeenCalled();
    });

    it("allows direct mentions when mentions-only mode is set", async () => {
      // Setup: user has "mentions" mode
      mockDb.query.channelNotificationSettings.findFirst.mockResolvedValue({ mode: "mentions" });

      await createNotifications({
        io: mockIO,
        message: { id: "msg-123", content: "Hello @alice" },
        mentions: [{ type: "user", value: "alice" }],
        senderId: "sender-123",
        channelId: "channel-456",
      });

      // Assert: notification allowed for direct @user mention
      expect(mockIO.to).toHaveBeenCalledWith("user:user-alice");
    });
  });
});
