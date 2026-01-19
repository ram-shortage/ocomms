import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createConversation,
  getConversation,
  getUserConversations,
  addParticipant,
  setConversationName,
} from "../conversation";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getFullOrganization: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock database
const mockMembersFindFirst = vi.fn();
const mockConversationsFindFirst = vi.fn();
const mockConversationsFindMany = vi.fn();
const mockParticipantsFindMany = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      members: { findFirst: (...args: unknown[]) => mockMembersFindFirst(...args) },
      conversations: {
        findFirst: (...args: unknown[]) => mockConversationsFindFirst(...args),
        findMany: (...args: unknown[]) => mockConversationsFindMany(...args)
      },
      conversationParticipants: {
        findMany: (...args: unknown[]) => mockParticipantsFindMany(...args)
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe("Conversation Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is authenticated
    mockGetSession.mockResolvedValue({
      user: { id: "user-A", name: "User A", email: "a@example.com" },
    });
  });

  describe("createConversation", () => {
    it("creates 1:1 conversation", async () => {
      // Setup: both users are org members, no existing conversation
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" }) // requester org membership
        .mockResolvedValueOnce({ id: "member-B" }); // participant org membership

      mockConversationsFindMany.mockResolvedValueOnce([]); // no existing conversations

      const newConv = { id: "conv-123", isGroup: false };
      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([newConv]),
            }),
          }),
        });
      });

      const result = await createConversation({
        organizationId: "org-789",
        participantIds: ["user-B"],
      });

      expect(result).toEqual(newConv);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("returns existing conversation for same participants", async () => {
      // Setup: both users are org members, existing conversation found
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" })
        .mockResolvedValueOnce({ id: "member-B" });

      // Existing 1:1 conversation between user-A and user-B
      mockConversationsFindMany.mockResolvedValueOnce([
        {
          id: "existing-conv",
          isGroup: false,
          participants: [{ userId: "user-A" }, { userId: "user-B" }],
        },
      ]);

      const result = await createConversation({
        organizationId: "org-789",
        participantIds: ["user-B"],
      });

      expect(result.id).toBe("existing-conv");
      expect(mockTransaction).not.toHaveBeenCalled(); // No new conversation created
    });

    it("creates group conversation for more than 2 participants", async () => {
      // Setup: all users are org members
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" }) // requester
        .mockResolvedValueOnce({ id: "member-B" }) // participant B
        .mockResolvedValueOnce({ id: "member-C" }); // participant C

      const newConv = { id: "conv-456", isGroup: true, name: "Project Team" };
      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([newConv]),
            }),
          }),
        });
      });

      const result = await createConversation({
        organizationId: "org-789",
        participantIds: ["user-B", "user-C"],
        name: "Project Team",
      });

      expect(result.isGroup).toBe(true);
    });

    it("validates participants in same org", async () => {
      // Setup: requester is org member, but participant is NOT
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" }) // requester OK
        .mockResolvedValueOnce(null); // participant NOT in org

      await expect(
        createConversation({
          organizationId: "org-789",
          participantIds: ["user-B-other-org"],
        })
      ).rejects.toThrow("All participants must be members of the organization");
    });

    it("rejects non-org member requester", async () => {
      mockMembersFindFirst.mockResolvedValueOnce(null); // requester NOT in org

      await expect(
        createConversation({
          organizationId: "org-789",
          participantIds: ["user-B"],
        })
      ).rejects.toThrow("Not authorized to create conversations in this organization");
    });

    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        createConversation({
          organizationId: "org-789",
          participantIds: ["user-B"],
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("deduplicates participant IDs including requester", async () => {
      // If requester includes themselves in participantIds, they should be deduped
      // The code iterates formData.participantIds, not the deduplicated set, so we need
      // to mock both user-A and user-B membership checks
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" }) // requester org membership
        .mockResolvedValueOnce({ id: "member-A" }) // user-A in participantIds (same user)
        .mockResolvedValueOnce({ id: "member-B" }); // user-B in participantIds

      mockConversationsFindMany.mockResolvedValueOnce([]); // no existing conversation

      const newConv = { id: "conv-123", isGroup: false };
      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([newConv]),
            }),
          }),
        });
      });

      // Note: createConversation deduplicates using Set for participant creation,
      // but still validates all participantIds for org membership
      const result = await createConversation({
        organizationId: "org-789",
        participantIds: ["user-A", "user-B"], // user-A duplicates requester
      });

      expect(result).toBeDefined();
    });
  });

  describe("getConversation", () => {
    it("returns conversation for participant", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce({
        id: "conv-123",
        isGroup: false,
        participants: [
          { userId: "user-A", user: { id: "user-A", name: "User A" } },
          { userId: "user-B", user: { id: "user-B", name: "User B" } },
        ],
      });

      const result = await getConversation("conv-123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("conv-123");
    });

    it("returns null for non-participant", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce({
        id: "conv-123",
        isGroup: false,
        participants: [
          { userId: "user-B" }, // user-A not in participants
          { userId: "user-C" },
        ],
      });

      const result = await getConversation("conv-123");

      expect(result).toBeNull();
    });

    it("returns null for non-existent conversation", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce(null);

      const result = await getConversation("non-existent");

      expect(result).toBeNull();
    });

    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getConversation("conv-123")).rejects.toThrow("Unauthorized");
    });
  });

  describe("getUserConversations", () => {
    it("returns user conversations for organization", async () => {
      mockParticipantsFindMany.mockResolvedValueOnce([
        {
          conversationId: "conv-1",
          conversation: {
            id: "conv-1",
            organizationId: "org-789",
            participants: [{ userId: "user-A" }, { userId: "user-B" }],
          },
        },
        {
          conversationId: "conv-2",
          conversation: {
            id: "conv-2",
            organizationId: "org-789",
            participants: [{ userId: "user-A" }, { userId: "user-C" }],
          },
        },
      ]);

      const result = await getUserConversations("org-789");

      expect(result).toHaveLength(2);
    });

    it("filters out conversations from other orgs", async () => {
      mockParticipantsFindMany.mockResolvedValueOnce([
        {
          conversationId: "conv-1",
          conversation: {
            id: "conv-1",
            organizationId: "org-789", // matching
            participants: [],
          },
        },
        {
          conversationId: "conv-2",
          conversation: {
            id: "conv-2",
            organizationId: "other-org", // different org
            participants: [],
          },
        },
      ]);

      const result = await getUserConversations("org-789");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("conv-1");
    });
  });

  describe("addParticipant", () => {
    it("adds participant to group conversation", async () => {
      mockConversationsFindFirst
        .mockResolvedValueOnce({
          id: "conv-123",
          organizationId: "org-789",
          isGroup: true,
          participants: [{ userId: "user-A" }],
        });
      mockMembersFindFirst.mockResolvedValueOnce({ id: "member-new" }); // new participant org membership

      mockInsert.mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => Promise.resolve(),
        }),
      });

      const result = await addParticipant("conv-123", "user-new");

      expect(result).toEqual({ success: true });
    });

    it("converts 1:1 to group when adding third participant", async () => {
      mockConversationsFindFirst
        .mockResolvedValueOnce({
          id: "conv-123",
          organizationId: "org-789",
          isGroup: false, // 1:1 conversation
          participants: [{ userId: "user-A" }, { userId: "user-B" }],
        });
      mockMembersFindFirst.mockResolvedValueOnce({ id: "member-new" });

      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      mockInsert.mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => Promise.resolve(),
        }),
      });

      const result = await addParticipant("conv-123", "user-C");

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalled(); // Should update isGroup to true
    });

    it("rejects non-participant", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce({
        id: "conv-123",
        participants: [{ userId: "other-user" }], // user-A not participant
      });

      await expect(addParticipant("conv-123", "user-new")).rejects.toThrow(
        "Not a participant"
      );
    });

    it("rejects if new participant not in org", async () => {
      mockConversationsFindFirst
        .mockResolvedValueOnce({
          id: "conv-123",
          organizationId: "org-789",
          isGroup: true,
          participants: [{ userId: "user-A" }],
        });
      mockMembersFindFirst.mockResolvedValueOnce(null); // new user NOT in org

      await expect(addParticipant("conv-123", "user-other-org")).rejects.toThrow(
        "User must be a member of the organization"
      );
    });

    it("rejects if conversation not found", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce(null);

      await expect(addParticipant("non-existent", "user-new")).rejects.toThrow(
        "Conversation not found"
      );
    });
  });

  describe("setConversationName", () => {
    it("sets name for group conversation", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce({
        id: "conv-123",
        isGroup: true,
        participants: [{ userId: "user-A" }],
      });

      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      const result = await setConversationName("conv-123", "New Name");

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("rejects naming 1:1 conversation", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce({
        id: "conv-123",
        isGroup: false, // 1:1 conversation
        participants: [{ userId: "user-A" }],
      });

      await expect(setConversationName("conv-123", "Name")).rejects.toThrow(
        "Cannot name 1:1 conversations"
      );
    });

    it("rejects non-participant", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce({
        id: "conv-123",
        isGroup: true,
        participants: [{ userId: "other-user" }],
      });

      await expect(setConversationName("conv-123", "Name")).rejects.toThrow(
        "Not a participant"
      );
    });

    it("rejects if conversation not found", async () => {
      mockConversationsFindFirst.mockResolvedValueOnce(null);

      await expect(setConversationName("non-existent", "Name")).rejects.toThrow(
        "Conversation not found"
      );
    });
  });

  describe("getOrCreateConversation idempotency", () => {
    it("is idempotent - returns same conversation on repeated calls", async () => {
      const existingConv = {
        id: "conv-123",
        isGroup: false,
        participants: [{ userId: "user-A" }, { userId: "user-B" }],
      };

      // First call: existing conversation found
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" })
        .mockResolvedValueOnce({ id: "member-B" });
      mockConversationsFindMany.mockResolvedValueOnce([existingConv]);

      const result1 = await createConversation({
        organizationId: "org-789",
        participantIds: ["user-B"],
      });

      // Second call should return same conversation
      mockMembersFindFirst
        .mockResolvedValueOnce({ id: "member-A" })
        .mockResolvedValueOnce({ id: "member-B" });
      mockConversationsFindMany.mockResolvedValueOnce([existingConv]);

      const result2 = await createConversation({
        organizationId: "org-789",
        participantIds: ["user-B"],
      });

      expect(result1.id).toBe(result2.id);
    });
  });
});
