/**
 * Dexie IndexedDB database definition for message caching.
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
 * OComms IndexedDB cache database.
 * Uses Dexie for a clean Promise-based API with TypeScript support.
 */
const db = new Dexie("OCommsCache") as Dexie & {
  messages: EntityTable<CachedMessage, "id">;
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

export { db };
