/**
 * Public exports for the message cache module.
 */

// Database and types
export { db, type CachedMessage } from "./db";

// Cache operations
export {
  cacheMessage,
  cacheMessages,
  getCachedChannelMessages,
  getCachedConversationMessages,
  cleanupExpiredMessages,
  updateMessageDeletion,
  clearAllCache,
} from "./messages";

// Initialization
export { initializeCache } from "./init";

// React hooks for cached messages
export {
  useCachedChannelMessages,
  useCachedConversationMessages,
} from "./use-cached-messages";
