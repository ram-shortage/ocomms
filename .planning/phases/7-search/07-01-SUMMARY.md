---
phase: 07-search
plan: 01
subsystem: database, api
tags: [postgresql, full-text-search, tsvector, drizzle, search]

requires:
  - phase: 03-real-time-messaging
    provides: messages table with content field
  - phase: 02-channels-dms
    provides: channelMembers and conversationParticipants for permissions

provides:
  - tsvector searchContent column on messages with GIN index
  - searchMessages server action with permission filtering
  - SearchResult type for typed search responses

affects: [07-02 search UI, future search enhancements]

tech-stack:
  added: []
  patterns:
    - customType for PostgreSQL tsvector in Drizzle ORM
    - Generated column for automatic search content indexing
    - GIN index for full-text search performance

key-files:
  created:
    - src/lib/actions/search.ts
  modified:
    - src/db/schema/message.ts

key-decisions:
  - "PostgreSQL native FTS over Meilisearch for data sovereignty"
  - "Generated tsvector column for automatic index updates"
  - "websearch_to_tsquery for natural language query parsing"
  - "Permission filtering at query time via channelMembers/conversationParticipants joins"

patterns-established:
  - "Full-text search uses english language config consistently"
  - "Search respects channel membership and conversation participation"
  - "Deleted messages excluded from search results"

duration: 1min
completed: 2026-01-18
---

# Phase 7 Plan 1: Full-Text Search Backend Summary

**PostgreSQL full-text search with tsvector column, GIN index, and permission-filtered search server action**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-18T10:18:31Z
- **Completed:** 2026-01-18T10:19:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added searchContent tsvector column with generated `to_tsvector('english', content)` expression
- Created GIN index for full-text search performance
- Implemented searchMessages server action with permission filtering
- Search returns ranked results with author and channel/conversation context

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tsvector search column to messages schema** - `afe08d7` (feat)
2. **Task 2: Create search server action with permission filtering** - `d0696b5` (feat)

## Files Created/Modified

- `src/db/schema/message.ts` - Added tsvector custom type, searchContent generated column, GIN index
- `src/lib/actions/search.ts` - New search server action with SearchResult type

## Decisions Made

1. **PostgreSQL native FTS** - Aligns with data sovereignty principle, no external dependencies
2. **Generated column** - Automatic index updates on insert/update without triggers
3. **websearch_to_tsquery** - Handles natural language input (AND/OR/quotes) vs strict to_tsquery
4. **Query-time permission filtering** - Join with channelMembers/conversationParticipants ensures consistent access control

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Database not running during verification, but TypeScript build confirmed schema correctness
- Migration will apply when database is available (`npm run db:push`)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Search backend complete, ready for search UI implementation (07-02)
- Database migration pending (requires running PostgreSQL for `npm run db:push`)
- Existing messages will automatically get searchContent populated by generated column

---
*Phase: 07-search*
*Completed: 2026-01-18*
