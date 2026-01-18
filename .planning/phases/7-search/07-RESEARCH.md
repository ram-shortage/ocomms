# Phase 7: Search - Research

**Researched:** 2026-01-18
**Domain:** Full-text message search with permission filtering
**Confidence:** HIGH

## Summary

This research evaluates two approaches for implementing full-text search in a Slack-like messaging application: PostgreSQL native full-text search and Meilisearch. Given the project's core value of data sovereignty (no third-party dependencies), PostgreSQL full-text search is the recommended approach.

PostgreSQL full-text search with Drizzle ORM provides a well-documented, performant solution for the expected scale (100k-500k messages). While Meilisearch offers superior typo tolerance and instant search UX, it adds infrastructure complexity and a dependency that conflicts with the data sovereignty principle. PostgreSQL FTS can be enhanced with the `pg_trgm` extension for basic fuzzy matching if needed later.

**Primary recommendation:** Use PostgreSQL full-text search with GIN indexes and generated `tsvector` columns. Implement permission filtering at query time using existing channel membership and conversation participant patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL FTS | Built-in | Full-text search | Zero dependencies, data stays in existing DB |
| Drizzle ORM | 0.45.1 | Schema + queries | Already in use, has FTS patterns |
| pg_trgm | Built-in | Fuzzy matching | Optional extension for typo tolerance |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fuzzystrmatch | Built-in | Phonetic matching | Names, proper nouns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL FTS | Meilisearch | Better UX (typo tolerance, instant) but adds Docker dependency, sync complexity |
| PostgreSQL FTS | Elasticsearch | Enterprise scale but massive operational overhead |
| GIN index | GiST index | GiST is smaller but GIN is faster for lookups |

**Installation:**
```bash
# No additional npm packages needed
# PostgreSQL extension (if fuzzy matching needed later):
# CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/schema/
│   └── message.ts        # Add searchContent tsvector column
├── lib/actions/
│   └── search.ts         # New: search server action
├── app/
│   └── [orgSlug]/
│       └── search/
│           └── page.tsx  # Search UI page
└── components/
    └── search/
        ├── search-input.tsx
        ├── search-results.tsx
        └── search-filters.tsx
```

### Pattern 1: Generated tsvector Column
**What:** Store pre-computed search vectors in the database
**When to use:** Always - faster queries, automatic index updates
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns
import { customType, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { SQL, sql } from "drizzle-orm";

export const tsvector = customType<{ data: string }>({
  dataType() {
    return `tsvector`;
  },
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  // ... other fields
  searchContent: tsvector("search_content")
    .generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${messages.content})`
    ),
}, (table) => [
  index("messages_search_idx").using("gin", table.searchContent),
]);
```

### Pattern 2: Permission-Filtered Search Query
**What:** Join search with membership tables to enforce access control
**When to use:** All search queries - security requirement
**Example:**
```typescript
// Source: Derived from existing channel.ts patterns
import { sql, and, eq, or, inArray } from "drizzle-orm";

async function searchMessages(
  userId: string,
  organizationId: string,
  query: string,
  limit = 50
) {
  // Get user's accessible channel IDs
  const userChannelMemberships = await db.query.channelMembers.findMany({
    where: eq(channelMembers.userId, userId),
    columns: { channelId: true },
  });
  const accessibleChannelIds = userChannelMemberships.map(m => m.channelId);

  // Get user's conversation IDs
  const userConversations = await db.query.conversationParticipants.findMany({
    where: eq(conversationParticipants.userId, userId),
    columns: { conversationId: true },
  });
  const accessibleConversationIds = userConversations.map(p => p.conversationId);

  // Search with permission filter
  return db
    .select()
    .from(messages)
    .where(
      and(
        sql`${messages.searchContent} @@ websearch_to_tsquery('english', ${query})`,
        or(
          inArray(messages.channelId, accessibleChannelIds),
          inArray(messages.conversationId, accessibleConversationIds)
        )
      )
    )
    .orderBy(sql`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${query})) DESC`)
    .limit(limit);
}
```

### Pattern 3: Search with Context (Channel/Author Filters)
**What:** Allow filtering by channel, author, date range
**When to use:** Advanced search features
**Example:**
```typescript
// Source: Slack search.messages API patterns
type SearchFilters = {
  channelId?: string;
  authorId?: string;
  after?: Date;
  before?: Date;
};

function buildSearchQuery(
  baseQuery: string,
  filters: SearchFilters,
  accessibleChannelIds: string[],
  accessibleConversationIds: string[]
) {
  const conditions = [
    sql`${messages.searchContent} @@ websearch_to_tsquery('english', ${baseQuery})`,
    or(
      inArray(messages.channelId, accessibleChannelIds),
      inArray(messages.conversationId, accessibleConversationIds)
    ),
  ];

  if (filters.channelId) {
    conditions.push(eq(messages.channelId, filters.channelId));
  }
  if (filters.authorId) {
    conditions.push(eq(messages.authorId, filters.authorId));
  }
  if (filters.after) {
    conditions.push(sql`${messages.createdAt} >= ${filters.after}`);
  }
  if (filters.before) {
    conditions.push(sql`${messages.createdAt} <= ${filters.before}`);
  }

  return and(...conditions);
}
```

### Anti-Patterns to Avoid
- **Searching without permission filter:** NEVER return messages from channels/DMs user cannot access
- **Using LIKE for search:** Use proper FTS, not `content LIKE '%query%'` - terrible performance
- **Indexing deleted messages:** Filter out `deletedAt IS NOT NULL` from search results
- **Skipping the GIN index:** Expression-based FTS without index is extremely slow

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text tokenization | Custom word splitting | `to_tsvector()` | Handles stemming, stop words, language rules |
| Query parsing | Regex query builder | `websearch_to_tsquery()` | Handles AND/OR/NOT, quotes, special chars |
| Relevance ranking | Custom scoring | `ts_rank()` / `ts_rank_cd()` | Considers term frequency, proximity |
| Fuzzy matching | Levenshtein manually | `pg_trgm` extension | Optimized trigram algorithms |
| Permission caching | Custom cache layer | Query-time join | Simpler, always consistent |

**Key insight:** PostgreSQL FTS has decades of optimization. Custom solutions will be slower, less accurate, and miss edge cases (stemming, stop words, language variations).

## Common Pitfalls

### Pitfall 1: Missing GIN Index on tsvector Column
**What goes wrong:** Search queries scan entire table, timeouts on any meaningful dataset
**Why it happens:** Generated column exists but developer forgets index
**How to avoid:** Always pair `searchContent` column with GIN index in same migration
**Warning signs:** Search queries taking >100ms on <10k messages

### Pitfall 2: Exposing Messages from Private Channels
**What goes wrong:** Search returns messages user shouldn't see
**Why it happens:** Forgot to join with channelMembers/conversationParticipants
**How to avoid:** Permission filter is REQUIRED on every search query, no exceptions
**Warning signs:** Search returning messages from channels not in sidebar

### Pitfall 3: Including Deleted Messages in Results
**What goes wrong:** Users see "[deleted]" messages in search or content of deleted messages
**Why it happens:** `deletedAt IS NULL` check missing
**How to avoid:** Add `deletedAt IS NULL` to search WHERE clause
**Warning signs:** Search results showing "deleted" or empty message content

### Pitfall 4: Wrong tsquery Function Choice
**What goes wrong:** Search returns unexpected results or errors on special characters
**Why it happens:** Using `to_tsquery()` which requires strict syntax vs `websearch_to_tsquery()` which handles natural input
**How to avoid:** Use `websearch_to_tsquery()` for user-facing search (handles "or", quotes, minus signs naturally)
**Warning signs:** Errors on searches like "meeting notes", queries with & | characters failing

### Pitfall 5: Not Specifying Language Configuration
**What goes wrong:** Index and query use different configs, index not used
**Why it happens:** Omitting 'english' parameter in some calls
**How to avoid:** ALWAYS use explicit language: `to_tsvector('english', ...)`, `websearch_to_tsquery('english', ...)`
**Warning signs:** EXPLAIN shows sequential scan despite GIN index existing

## Code Examples

Verified patterns from official sources:

### Schema with Generated tsvector Column
```typescript
// Source: https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns
import { customType, index, pgTable, text, uuid, timestamp, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { SQL, sql } from "drizzle-orm";

export const tsvector = customType<{ data: string }>({
  dataType() {
    return `tsvector`;
  },
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  authorId: uuid("author_id").notNull(),
  channelId: uuid("channel_id"),
  conversationId: uuid("conversation_id"),
  parentId: uuid("parent_id"),
  replyCount: integer("reply_count").notNull().default(0),
  sequence: integer("sequence").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Generated search column
  searchContent: tsvector("search_content")
    .generatedAlwaysAs((): SQL => sql`to_tsvector('english', ${messages.content})`),
}, (table) => [
  index("messages_channel_seq_idx").on(table.channelId, table.sequence),
  index("messages_conversation_seq_idx").on(table.conversationId, table.sequence),
  index("messages_author_idx").on(table.authorId),
  index("messages_parent_idx").on(table.parentId),
  // GIN index for full-text search
  index("messages_search_idx").using("gin", table.searchContent),
]);
```

### Basic Search Query with Ranking
```typescript
// Source: https://orm.drizzle.team/docs/guides/postgresql-full-text-search
import { sql, desc, and, isNull } from "drizzle-orm";

export async function searchMessages(query: string, channelIds: string[]) {
  return db
    .select({
      id: messages.id,
      content: messages.content,
      channelId: messages.channelId,
      authorId: messages.authorId,
      createdAt: messages.createdAt,
      rank: sql<number>`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${query}))`,
    })
    .from(messages)
    .where(
      and(
        sql`${messages.searchContent} @@ websearch_to_tsquery('english', ${query})`,
        inArray(messages.channelId, channelIds),
        isNull(messages.deletedAt)
      )
    )
    .orderBy(desc(sql`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${query}))`))
    .limit(50);
}
```

### Server Action Pattern
```typescript
// Source: Derived from existing lib/actions patterns
"use server";

import { db } from "@/db";
import { messages, channelMembers, conversationParticipants } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sql, and, or, eq, isNull, inArray, desc } from "drizzle-orm";

export type SearchResult = {
  id: string;
  content: string;
  channelId: string | null;
  conversationId: string | null;
  authorId: string;
  createdAt: Date;
  rank: number;
};

export async function searchMessages(
  organizationId: string,
  query: string,
  filters?: {
    channelId?: string;
    authorId?: string;
  }
): Promise<SearchResult[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get accessible channels (member of)
  const channelMemberships = await db.query.channelMembers.findMany({
    where: eq(channelMembers.userId, session.user.id),
    with: { channel: true },
  });
  const accessibleChannelIds = channelMemberships
    .filter(m => m.channel.organizationId === organizationId)
    .map(m => m.channelId);

  // Get accessible conversations (participant in)
  const conversationMemberships = await db.query.conversationParticipants.findMany({
    where: eq(conversationParticipants.userId, session.user.id),
    with: { conversation: true },
  });
  const accessibleConversationIds = conversationMemberships
    .filter(p => p.conversation.organizationId === organizationId)
    .map(p => p.conversationId);

  // Build permission condition
  const permissionCondition = or(
    accessibleChannelIds.length > 0
      ? inArray(messages.channelId, accessibleChannelIds)
      : sql`false`,
    accessibleConversationIds.length > 0
      ? inArray(messages.conversationId, accessibleConversationIds)
      : sql`false`
  );

  // Build filter conditions
  const conditions = [
    sql`${messages.searchContent} @@ websearch_to_tsquery('english', ${query})`,
    permissionCondition,
    isNull(messages.deletedAt),
  ];

  if (filters?.channelId) {
    conditions.push(eq(messages.channelId, filters.channelId));
  }
  if (filters?.authorId) {
    conditions.push(eq(messages.authorId, filters.authorId));
  }

  const results = await db
    .select({
      id: messages.id,
      content: messages.content,
      channelId: messages.channelId,
      conversationId: messages.conversationId,
      authorId: messages.authorId,
      createdAt: messages.createdAt,
      rank: sql<number>`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${query}))`,
    })
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(sql`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${query}))`))
    .limit(50);

  return results;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LIKE queries | Full-text search | Long established | 100x+ performance improvement |
| Separate tsvector column + trigger | Generated columns | PostgreSQL 12+ | Simpler schema, automatic sync |
| to_tsquery() | websearch_to_tsquery() | PostgreSQL 11+ | Natural language input support |
| Expression index only | Generated column + GIN | Drizzle recent | Better DX, clearer schema |

**Deprecated/outdated:**
- Manual tsvector column updates with triggers (use generated columns)
- Using `to_tsquery()` for user input (use `websearch_to_tsquery()`)
- GiST indexes for FTS (use GIN for read-heavy workloads)

## Alternative: Meilisearch (Not Recommended for This Project)

For reference, if Meilisearch were chosen:

### Setup
```yaml
# docker-compose.yml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.15
    ports:
      - "7700:7700"
    volumes:
      - ./meili_data:/meili_data
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
```

### Why Not Recommended
1. **Conflicts with data sovereignty:** Adds external service dependency
2. **Sync complexity:** Must keep Meilisearch index in sync with PostgreSQL
3. **Operational overhead:** Another service to monitor, backup, upgrade
4. **Overkill for scale:** PostgreSQL FTS handles 100k-500k messages easily
5. **Permission complexity:** Requires tenant tokens or filtering in sync

### When Meilisearch Would Make Sense
- User experience is primary differentiator (instant search, typo tolerance critical)
- Dataset exceeds 10M+ messages
- Team has DevOps capacity for additional infrastructure
- Real-time search UX requirements justify complexity

## Open Questions

Things that couldn't be fully resolved:

1. **Performance at larger scale**
   - What we know: PostgreSQL FTS works well up to a few million rows
   - What's unclear: Exact performance characteristics for this specific schema
   - Recommendation: Monitor query times, add EXPLAIN ANALYZE to logs

2. **Multi-language support**
   - What we know: PostgreSQL has language-specific configs ('english', 'spanish', etc.)
   - What's unclear: Whether users will need non-English search
   - Recommendation: Start with 'english', can add language detection later

3. **Highlight/snippet generation**
   - What we know: PostgreSQL has `ts_headline()` for snippets
   - What's unclear: Performance impact of headline generation
   - Recommendation: Implement if needed, but not in MVP

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM PostgreSQL Full-Text Search](https://orm.drizzle.team/docs/guides/postgresql-full-text-search) - Query patterns, GIN index syntax
- [Drizzle ORM Generated Columns](https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns) - tsvector custom type, schema definition
- [PostgreSQL Documentation: Text Search Indexes](https://www.postgresql.org/docs/current/textsearch-indexes.html) - GIN vs GiST, index types
- [PostgreSQL Documentation: Tables and Indexes](https://www.postgresql.org/docs/current/textsearch-tables.html) - Configuration naming requirement

### Secondary (MEDIUM confidence)
- [Meilisearch Docker Guide](https://www.meilisearch.com/docs/guides/docker) - Setup patterns if alternative needed
- [Meilisearch Tenant Tokens](https://www.meilisearch.com/docs/learn/security/tenant_tokens) - Permission filtering approach
- [Supabase: Postgres Full Text Search vs the Rest](https://supabase.com/blog/postgres-full-text-search-vs-the-rest) - Performance comparisons
- [Meilisearch Blog: When Postgres Stops Being Good Enough](https://www.meilisearch.com/blog/postgres-full-text-search-limitations) - Scale boundaries

### Tertiary (LOW confidence)
- [Medium: PostgreSQL FTS for 200M Rows](https://medium.com/@yogeshsherawat/using-full-text-search-fts-in-postgresql-for-over-200-million-rows-a-case-study-e0a347df14d0) - Large scale patterns
- [Slack Engineering: Search at Slack](https://slack.engineering/search-at-slack/) - Architecture inspiration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Drizzle docs + PostgreSQL docs
- Architecture: HIGH - Patterns from existing codebase + official examples
- Pitfalls: HIGH - Well-documented in official sources
- Performance: MEDIUM - General guidance, specific benchmarks not run

**Research date:** 2026-01-18
**Valid until:** 60 days (PostgreSQL FTS is stable, Drizzle patterns established)
