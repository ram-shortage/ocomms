# Phase 26: User Status Bugs

**Discovered:** 2026-01-21 during verification testing
**Phase:** 26 - Collections & Presence
**Target:** Phase 29 - Stabilization

## Summary

The User Status feature UI components work correctly, but status data is not persisting to the database after save. Bookmarks feature works completely.

## Bugs

### BUG-26-01: User status not persisting after save

**Severity:** High
**Requirements affected:** STAT-02, STAT-03, STAT-05, STAT-06

**Expected behavior:**
- User sets status (emoji, text, expiration, DND)
- Clicks Save
- Status persists to database
- Status appears in sidebar on page reload
- Status appears next to username in messages

**Actual behavior:**
- Status editor opens and works correctly
- Presets populate fields correctly
- Expiration options work in UI
- DND toggle works in UI
- After clicking Save and reloading page, status is empty
- No error messages shown to user

**Investigation notes:**
1. Fixed `STATUS_PRESETS` export error (was exporting object from "use server" file)
2. Server returns 200 on POST requests
3. `setUserStatus` action in `src/lib/actions/user-status.ts` appears correct
4. `revalidatePath("/")` is called but may not trigger client-side refresh
5. Need to verify: Is the database insert/upsert actually executing?

**Files involved:**
- `src/lib/actions/user-status.ts` - setUserStatus action
- `src/components/status/status-editor.tsx` - handleSave function
- `src/components/workspace/workspace-sidebar.tsx` - StatusEditor integration
- `src/db/schema/user-status.ts` - userStatuses table

**Suggested investigation:**
1. Add console.log in setUserStatus to confirm it's being called
2. Check if database write is occurring (query the user_statuses table)
3. Verify onClose callback is passed to StatusEditor from sidebar
4. Check if myStatus prop is being passed correctly after save

---

## Verification Results

### Bookmarks - PASSED
| Requirement | Status |
|-------------|--------|
| BOOK-01: Save messages | PASS |
| BOOK-02: Save files | NOT TESTED (need file attachment) |
| BOOK-03: View saved items | PASS |
| BOOK-04: Remove from saved | PASS |
| BOOK-05: Jump to original | PASS |

### User Status - BLOCKED
| Requirement | Status |
|-------------|--------|
| STAT-01: Custom status emoji + text | UI WORKS |
| STAT-02: Status visible next to name | BLOCKED (save fails) |
| STAT-03: Status expiration | UI WORKS (untestable) |
| STAT-04: Preset status options | PASS |
| STAT-05: Clear status manually | BLOCKED (no status to clear) |
| STAT-06: DND pauses notifications | BLOCKED (save fails) |
