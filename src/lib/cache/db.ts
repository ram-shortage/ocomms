/**
 * Dexie IndexedDB database definition for message caching and send queue.
 * Provides offline-first message storage with TTL-based cleanup.
 */
import Dexie, { type EntityTable } from "dexie";

/**
 * Cached message interface - maps from Message (socket-events.ts).
 * Flattens the author object and adds cachedAt for TTL cleanup.
 */
export interface CachedMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  channelId: string | null;
  conversationId: string | null;
  parentId: string | null;
  replyCount: number;
  sequence: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cachedAt: Date;
}

/**
 * Send status for queued messages.
 */
export type SendStatus = "pending" | "sending" | "sent" | "failed";

/**
 * Queued message interface for offline send queue.
 * Messages are stored here until successfully sent to the server.
 */
export interface QueuedMessage {
  /** Primary key - UUID generated on client */
  clientId: string;
  /** Set when server confirms the message was sent */
  serverId: string | null;
  /** Message content */
  content: string;
  /** Channel ID or conversation ID */
  targetId: string;
  /** Target type: channel or DM */
  targetType: "channel" | "dm";
  /** Parent message ID for thread replies */
  parentId: string | null;
  /** Attachment IDs to associate with message (FILE-01) */
  attachmentIds: string[] | null;
  /** Current send status */
  status: SendStatus;
  /** Number of retry attempts */
  retryCount: number;
  /** Last error message if failed */
  lastError: string | null;
  /** When the message was created */
  createdAt: Date;
  /** When the last send attempt was made */
  lastAttemptAt: Date | null;
}

/**
 * OComms IndexedDB cache database.
 * Uses Dexie for a clean Promise-based API with TypeScript support.
 */
const db = new Dexie("OCommsCache") as Dexie & {
  messages: EntityTable<CachedMessage, "id">;
  sendQueue: EntityTable<QueuedMessage, "clientId">;
};

/**
 * Schema version 1:
 * - Primary key: id (message UUID)
 * - Compound index: [channelId+sequence] for ordered channel message queries
 * - Compound index: [conversationId+sequence] for ordered DM queries
 * - Index: cachedAt for TTL cleanup queries
 */
db.version(1).stores({
  messages: "id, [channelId+sequence], [conversationId+sequence], cachedAt",
});

/**
 * Schema version 2:
 * - Adds sendQueue table for offline message sending
 * - Primary key: clientId (UUID generated on client)
 * - Compound index: [targetId+status] for efficient pending message queries by target
 * - Index: status for filtering by send status
 * - Index: createdAt for FIFO ordering
 */
db.version(2).stores({
  messages: "id, [channelId+sequence], [conversationId+sequence], cachedAt",
  sendQueue: "clientId, [targetId+status], status, createdAt",
});

export { db };
