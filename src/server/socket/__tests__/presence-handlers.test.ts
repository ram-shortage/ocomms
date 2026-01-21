import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the rooms module
vi.mock("../rooms", () => ({
  getRoomName: {
    channel: (id: string) => `channel:${id}`,
    conversation: (id: string) => `dm:${id}`,
    workspace: (id: string) => `workspace:${id}`,
    user: (id: string) => `user:${id}`,
  },
}));

// Mock Socket and IO types for testing
interface MockSocket {
  data: {
    userId: string;
    workspaceId?: string;
    user?: { name?: string; email?: string };
  };
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

interface MockIO {
  to: ReturnType<typeof vi.fn>;
}

// Mock Redis
interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  pipeline: ReturnType<typeof vi.fn>;
}

type PresenceStatus = "active" | "away" | "offline";

const PRESENCE_TTL = 60; // seconds

// Simulated presence key generation
function getPresenceKey(workspaceId: string, userId: string): string {
  return `presence:${workspaceId}:${userId}`;
}

// Simulated PresenceManager
interface PresenceManager {
  setOnline(userId: string, workspaceId: string): Promise<void>;
  setAway(userId: string, workspaceId: string): Promise<void>;
  setOffline(userId: string, workspaceId: string): Promise<void>;
  getStatus(userId: string, workspaceId: string): Promise<PresenceStatus>;
  getWorkspacePresence(workspaceId: string, userIds: string[]): Promise<Record<string, PresenceStatus>>;
  heartbeat(userId: string, workspaceId: string): Promise<void>;
}

function createPresenceManager(io: MockIO, redis: MockRedis): PresenceManager {
  const broadcastPresence = (workspaceId: string, userId: string, status: PresenceStatus) => {
    io.to(`workspace:${workspaceId}`).emit("presence:update", { userId, status });
  };

  return {
    async setOnline(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.setex(key, PRESENCE_TTL, "active");
      broadcastPresence(workspaceId, userId, "active");
    },

    async setAway(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.setex(key, PRESENCE_TTL, "away");
      broadcastPresence(workspaceId, userId, "away");
    },

    async setOffline(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.del(key);
      broadcastPresence(workspaceId, userId, "offline");
    },

    async getStatus(userId: string, workspaceId: string): Promise<PresenceStatus> {
      const key = getPresenceKey(workspaceId, userId);
      const status = await redis.get(key);
      if (status === "active" || status === "away") {
        return status;
      }
      return "offline";
    },

    async getWorkspacePresence(workspaceId: string, userIds: string[]): Promise<Record<string, PresenceStatus>> {
      if (userIds.length === 0) return {};

      const pipeline = redis.pipeline();
      for (const userId of userIds) {
        pipeline.get(getPresenceKey(workspaceId, userId));
      }

      const results = await pipeline.exec();
      const presenceMap: Record<string, PresenceStatus> = {};

      if (results) {
        for (let i = 0; i < userIds.length; i++) {
          const [err, status] = results[i];
          if (!err && (status === "active" || status === "away")) {
            presenceMap[userIds[i]] = status as PresenceStatus;
          } else {
            presenceMap[userIds[i]] = "offline";
          }
        }
      }

      return presenceMap;
    },

    async heartbeat(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.expire(key, PRESENCE_TTL);
    },
  };
}

// Simulated presence event handler setup
function setupPresenceEventHandlers(
  socket: MockSocket,
  io: MockIO,
  presence: PresenceManager,
  disconnectCallbacks: Array<() => Promise<void>>
): void {
  socket.on("presence:setActive", async () => {
    const workspaceId = socket.data.workspaceId;
    if (workspaceId) {
      await presence.setOnline(socket.data.userId, workspaceId);
    }
  });

  socket.on("presence:setAway", async () => {
    const workspaceId = socket.data.workspaceId;
    if (workspaceId) {
      await presence.setAway(socket.data.userId, workspaceId);
    }
  });

  socket.on("disconnect", async () => {
    const workspaceId = socket.data.workspaceId;
    if (workspaceId) {
      await presence.setOffline(socket.data.userId, workspaceId);
    }
    // Trigger any registered callbacks
    for (const cb of disconnectCallbacks) {
      await cb();
    }
  });
}

/**
 * M-12 DoS Prevention Tests for Presence
 *
 * Tests that validate array size caps in presence:fetch handler
 * to prevent DoS attacks through unbounded userIds arrays.
 */
describe("Presence Handler DoS Prevention (M-12)", () => {
  const sourcePath = require("path").resolve(__dirname, "../index.ts");
  const source = require("fs").readFileSync(sourcePath, "utf-8");

  describe("Array size caps in presence:fetch", () => {
    it("defines maximum IDs per request constant", () => {
      expect(source).toContain("MAX_IDS_PER_REQUEST");
      expect(source).toMatch(/MAX_IDS_PER_REQUEST\s*=\s*100/);
    });

    it("checks userIds array length before processing", () => {
      // Should check data.userIds.length against MAX_IDS_PER_REQUEST
      expect(source).toContain("data.userIds.length > MAX_IDS_PER_REQUEST");
    });

    it("emits error when array exceeds limit", () => {
      expect(source).toContain("Maximum ${MAX_IDS_PER_REQUEST} user IDs per request");
    });

    it("returns empty object when limit exceeded", () => {
      // Should return empty presence map
      expect(source).toContain("callback({});");
    });
  });
});

describe("Presence Handlers", () => {
  let mockSocket: MockSocket;
  let mockIO: MockIO;
  let mockRedis: MockRedis;
  let emitFn: ReturnType<typeof vi.fn>;
  let presenceManager: PresenceManager;
  let socketEventHandlers: Map<string, () => Promise<void>>;

  beforeEach(() => {
    vi.clearAllMocks();

    emitFn = vi.fn();
    mockIO = {
      to: vi.fn().mockReturnValue({ emit: emitFn }),
    };

    const pipelineGet = vi.fn();
    const pipelineExec = vi.fn();

    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      expire: vi.fn(),
      pipeline: vi.fn().mockReturnValue({
        get: pipelineGet,
        exec: pipelineExec,
      }),
    };

    socketEventHandlers = new Map();
    mockSocket = {
      data: {
        userId: "user-123",
        workspaceId: "workspace-456",
        user: { name: "Test User", email: "test@example.com" },
      },
      emit: vi.fn(),
      on: vi.fn().mockImplementation((event: string, handler: () => Promise<void>) => {
        socketEventHandlers.set(event, handler);
      }),
    };

    presenceManager = createPresenceManager(mockIO, mockRedis);
  });

  describe("presence:setActive", () => {
    it("sets user status to active", async () => {
      await presenceManager.setOnline("user-123", "workspace-456");

      // Assert: Redis key set
      expect(mockRedis.setex).toHaveBeenCalledWith(
        "presence:workspace-456:user-123",
        PRESENCE_TTL,
        "active"
      );
    });

    it("broadcasts to workspace members", async () => {
      await presenceManager.setOnline("user-123", "workspace-456");

      // Assert: workspace room receives presence:update event
      expect(mockIO.to).toHaveBeenCalledWith("workspace:workspace-456");
      expect(emitFn).toHaveBeenCalledWith("presence:update", {
        userId: "user-123",
        status: "active",
      });
    });

    it("sets presence with TTL", async () => {
      await presenceManager.setOnline("user-123", "workspace-456");

      // Assert: setex called with TTL
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        PRESENCE_TTL,
        "active"
      );
    });
  });

  describe("presence:setAway", () => {
    it("sets user status to away", async () => {
      await presenceManager.setAway("user-123", "workspace-456");

      // Assert: Redis key updated to "away"
      expect(mockRedis.setex).toHaveBeenCalledWith(
        "presence:workspace-456:user-123",
        PRESENCE_TTL,
        "away"
      );
    });

    it("broadcasts away status to workspace", async () => {
      await presenceManager.setAway("user-123", "workspace-456");

      expect(mockIO.to).toHaveBeenCalledWith("workspace:workspace-456");
      expect(emitFn).toHaveBeenCalledWith("presence:update", {
        userId: "user-123",
        status: "away",
      });
    });
  });

  describe("presence:fetch (getStatus)", () => {
    it("returns active status for active user", async () => {
      mockRedis.get.mockResolvedValue("active");

      const status = await presenceManager.getStatus("user-123", "workspace-456");

      expect(status).toBe("active");
      expect(mockRedis.get).toHaveBeenCalledWith("presence:workspace-456:user-123");
    });

    it("returns away status for away user", async () => {
      mockRedis.get.mockResolvedValue("away");

      const status = await presenceManager.getStatus("user-123", "workspace-456");

      expect(status).toBe("away");
    });

    it("returns offline for users not in Redis", async () => {
      mockRedis.get.mockResolvedValue(null);

      const status = await presenceManager.getStatus("user-123", "workspace-456");

      expect(status).toBe("offline");
    });

    it("returns offline for invalid status values", async () => {
      mockRedis.get.mockResolvedValue("invalid-status");

      const status = await presenceManager.getStatus("user-123", "workspace-456");

      expect(status).toBe("offline");
    });
  });

  describe("getWorkspacePresence (bulk fetch)", () => {
    it("returns presence for multiple users", async () => {
      const pipelineExec = vi.fn().mockResolvedValue([
        [null, "active"],
        [null, "away"],
        [null, null], // charlie not in Redis
      ]);
      const pipelineGet = vi.fn().mockReturnThis();

      mockRedis.pipeline.mockReturnValue({
        get: pipelineGet,
        exec: pipelineExec,
      });

      const presence = await presenceManager.getWorkspacePresence("workspace-456", [
        "alice",
        "bob",
        "charlie",
      ]);

      expect(presence).toEqual({
        alice: "active",
        bob: "away",
        charlie: "offline",
      });
    });

    it("returns empty object for empty user list", async () => {
      const presence = await presenceManager.getWorkspacePresence("workspace-456", []);

      expect(presence).toEqual({});
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it("uses pipeline for efficient Redis queries", async () => {
      const pipelineGet = vi.fn().mockReturnThis();
      const pipelineExec = vi.fn().mockResolvedValue([
        [null, "active"],
        [null, "active"],
      ]);

      mockRedis.pipeline.mockReturnValue({
        get: pipelineGet,
        exec: pipelineExec,
      });

      await presenceManager.getWorkspacePresence("workspace-456", ["user1", "user2"]);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(pipelineGet).toHaveBeenCalledTimes(2);
      expect(pipelineExec).toHaveBeenCalled();
    });
  });

  describe("Heartbeat", () => {
    it("refreshes TTL for active user", async () => {
      await presenceManager.heartbeat("user-123", "workspace-456");

      expect(mockRedis.expire).toHaveBeenCalledWith(
        "presence:workspace-456:user-123",
        PRESENCE_TTL
      );
    });

    it("does not change status", async () => {
      // Heartbeat should only refresh TTL, not change the status
      await presenceManager.heartbeat("user-123", "workspace-456");

      // setex should not be called (only expire)
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe("Disconnect handling", () => {
    it("sets user to offline on socket disconnect", async () => {
      const disconnectCallbacks: Array<() => Promise<void>> = [];
      setupPresenceEventHandlers(mockSocket, mockIO, presenceManager, disconnectCallbacks);

      // Simulate disconnect
      const disconnectHandler = socketEventHandlers.get("disconnect");
      expect(disconnectHandler).toBeDefined();

      await disconnectHandler!();

      // Assert: presence deleted from Redis
      expect(mockRedis.del).toHaveBeenCalledWith("presence:workspace-456:user-123");
      // Assert: offline status broadcast
      expect(mockIO.to).toHaveBeenCalledWith("workspace:workspace-456");
      expect(emitFn).toHaveBeenCalledWith("presence:update", {
        userId: "user-123",
        status: "offline",
      });
    });

    it("does not broadcast if no workspace set", async () => {
      mockSocket.data.workspaceId = undefined;

      const disconnectCallbacks: Array<() => Promise<void>> = [];
      setupPresenceEventHandlers(mockSocket, mockIO, presenceManager, disconnectCallbacks);

      const disconnectHandler = socketEventHandlers.get("disconnect");
      await disconnectHandler!();

      // Assert: nothing should happen
      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe("Socket event handlers", () => {
    it("handles presence:setActive event", async () => {
      const disconnectCallbacks: Array<() => Promise<void>> = [];
      setupPresenceEventHandlers(mockSocket, mockIO, presenceManager, disconnectCallbacks);

      const setActiveHandler = socketEventHandlers.get("presence:setActive");
      expect(setActiveHandler).toBeDefined();

      await setActiveHandler!();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "presence:workspace-456:user-123",
        PRESENCE_TTL,
        "active"
      );
    });

    it("handles presence:setAway event", async () => {
      const disconnectCallbacks: Array<() => Promise<void>> = [];
      setupPresenceEventHandlers(mockSocket, mockIO, presenceManager, disconnectCallbacks);

      const setAwayHandler = socketEventHandlers.get("presence:setAway");
      expect(setAwayHandler).toBeDefined();

      await setAwayHandler!();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "presence:workspace-456:user-123",
        PRESENCE_TTL,
        "away"
      );
    });

    it("ignores presence events when no workspace set", async () => {
      mockSocket.data.workspaceId = undefined;

      const disconnectCallbacks: Array<() => Promise<void>> = [];
      setupPresenceEventHandlers(mockSocket, mockIO, presenceManager, disconnectCallbacks);

      const setActiveHandler = socketEventHandlers.get("presence:setActive");
      await setActiveHandler!();

      // Should not call Redis or broadcast
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe("Organization membership check", () => {
    it("presence is scoped to workspace", async () => {
      // User in workspace-A
      await presenceManager.setOnline("user-123", "workspace-A");

      // Check if key uses workspace-scoped key
      expect(mockRedis.setex).toHaveBeenCalledWith(
        "presence:workspace-A:user-123",
        expect.any(Number),
        "active"
      );

      vi.clearAllMocks();

      // Same user in workspace-B (different key)
      await presenceManager.setOnline("user-123", "workspace-B");

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "presence:workspace-B:user-123",
        expect.any(Number),
        "active"
      );
    });

    it("broadcasts only to the correct workspace room", async () => {
      await presenceManager.setOnline("user-123", "workspace-A");

      expect(mockIO.to).toHaveBeenCalledWith("workspace:workspace-A");
      expect(mockIO.to).not.toHaveBeenCalledWith("workspace:workspace-B");
    });

    it("fetching presence uses workspace-scoped keys", async () => {
      mockRedis.get.mockResolvedValue("active");

      await presenceManager.getStatus("user-123", "workspace-A");

      expect(mockRedis.get).toHaveBeenCalledWith("presence:workspace-A:user-123");
    });
  });

  describe("TTL expiration behavior", () => {
    it("presence expires after TTL if no heartbeat", async () => {
      // Set user online
      await presenceManager.setOnline("user-123", "workspace-456");

      // Redis setex is called with TTL
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        PRESENCE_TTL,
        "active"
      );

      // After TTL, Redis returns null
      mockRedis.get.mockResolvedValue(null);

      const status = await presenceManager.getStatus("user-123", "workspace-456");
      expect(status).toBe("offline");
    });

    it("heartbeat extends TTL", async () => {
      // First set online
      await presenceManager.setOnline("user-123", "workspace-456");

      vi.clearAllMocks();

      // Then heartbeat
      await presenceManager.heartbeat("user-123", "workspace-456");

      // expire should be called to extend TTL
      expect(mockRedis.expire).toHaveBeenCalledWith(
        "presence:workspace-456:user-123",
        PRESENCE_TTL
      );
    });
  });
});
