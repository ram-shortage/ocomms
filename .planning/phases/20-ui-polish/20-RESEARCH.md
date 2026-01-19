# Phase 20: UI Polish - Research

**Researched:** 2026-01-19
**Domain:** UI completion, admin features, security headers, documentation
**Confidence:** HIGH

## Summary

Phase 20 is a polish phase that completes remaining UI gaps for the v0.3.0 milestone. The codebase investigation reveals that most underlying infrastructure already exists - the work is primarily about adding UI components to expose existing functionality and minor configuration changes.

Key findings:
1. **Sidebar already has navigation links** - UIPOL-01 is already complete. The `workspace-sidebar.tsx` includes links to `/threads` and `/search` with proper active state highlighting.
2. **LogoutButton component exists** but is not integrated into the main layout - needs to be added to sidebar footer.
3. **Audit log API exists** (`/api/admin/audit-logs`) with filtering and pagination - needs UI viewer component.
4. **Data export API exists** (`/api/admin/export`) with JSON output - needs UI trigger and CSV support.
5. **USER-SETUP.md does not exist** - needs to be created from README patterns.
6. **HSTS is set to 3600** (1 hour) in nginx config - needs update to 31536000 (1 year).

**Primary recommendation:** Focus on building admin UI components (audit log viewer, export UI) and integrating the existing LogoutButton into the sidebar. These are straightforward component additions leveraging existing APIs.

## Current State Analysis

### UIPOL-01: Sidebar Navigation - ALREADY COMPLETE

The sidebar already includes navigation links for /threads and /search:

**File:** `/Users/brett/Documents/code/ocomms/src/components/workspace/workspace-sidebar.tsx`
```typescript
{/* Quick links */}
<div className="px-3 py-1">
  <Link
    href={`/${workspace.slug}/threads`}
    className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
      pathname === `/${workspace.slug}/threads` && "bg-accent"
    )}
  >
    <MessageSquare className="h-4 w-4" />
    Threads
  </Link>
  <Link
    href={`/${workspace.slug}/search`}
    className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
      pathname === `/${workspace.slug}/search` && "bg-accent"
    )}
  >
    <Search className="h-4 w-4" />
    Search
  </Link>
</div>
```

Both pages exist:
- `/Users/brett/Documents/code/ocomms/src/app/(workspace)/[workspaceSlug]/threads/page.tsx`
- `/Users/brett/Documents/code/ocomms/src/app/(workspace)/[workspaceSlug]/search/page.tsx`

**Status:** No work needed. Verify requirement is met.

### UIPOL-02: Logout Button

**Existing component:** `/Users/brett/Documents/code/ocomms/src/components/auth/logout-button.tsx`
```typescript
"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <Button
      onClick={handleLogout}
      variant="destructive"
      className="mt-4"
    >
      Sign Out
    </Button>
  );
}
```

**Current sidebar footer:**
```typescript
{/* Footer */}
<div className="p-3 border-t space-y-1 text-sm">
  <Link href={`/${workspace.slug}/profile`} ...>Edit Profile</Link>
  <Link href={`/${workspace.slug}/settings`} ...>Settings</Link>
</div>
```

**Work needed:** Add LogoutButton to sidebar footer. May need to style differently (text link or icon button to match existing footer items).

### UIPOL-03: Audit Log Viewer

**Existing API:** `/api/admin/audit-logs`

Supports:
- Query params: `from`, `to`, `eventType`, `limit`, `offset`
- Authorization: Requires admin/owner role in organization
- Pagination: Returns `{ events, pagination: { total, limit, offset, hasMore } }`

**Event types available:**
```typescript
enum AuditEventType {
  AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_PASSWORD_RESET = "AUTH_PASSWORD_RESET",
  ADMIN_UNLOCK_USER = "ADMIN_UNLOCK_USER",
  ADMIN_EXPORT_DATA = "ADMIN_EXPORT_DATA",
  AUTHZ_FAILURE = "AUTHZ_FAILURE",
}
```

**Event structure:**
```typescript
interface AuditEvent {
  timestamp: string;      // ISO 8601
  eventType: AuditEventType;
  userId?: string;
  targetId?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}
```

**Work needed:**
1. Create admin page: `src/app/(workspace)/[workspaceSlug]/settings/admin/page.tsx`
2. Create audit log viewer component with:
   - Table display (timestamp, event type, user, IP)
   - Date range filter
   - Event type filter dropdown
   - Pagination controls
   - Export to CSV button

### UIPOL-04: Data Export UI

**Existing API:** `POST /api/admin/export`

Request: `{ organizationId: string }`
Response: JSON file download with `Content-Disposition: attachment`

Current export includes:
- Organization details
- Members with profiles
- Channels with messages and reactions
- Direct messages with reactions
- Pinned messages
- Notifications
- Channel settings and read states

**Work needed:**
1. Add export UI to admin settings page
2. Support CSV export (API currently only supports JSON)
3. Show export manifest/summary before download

### UIPOL-05: USER-SETUP.md

**Does not exist.** Need to create comprehensive setup documentation.

Content should cover:
1. Prerequisites (Docker, domain, SMTP optional)
2. Initial deployment steps
3. Creating first organization
4. Inviting first members
5. Configuring push notifications
6. Backup setup
7. Updating OComms

Use existing README.md patterns for consistency.

### UIPOL-06: HSTS Configuration

**Current value:** `/Users/brett/Documents/code/ocomms/nginx/conf.d/default.conf`
```nginx
add_header Strict-Transport-Security "max-age=3600" always;
```

**Required value:**
```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

Change from 1 hour to 1 year for production security.

## Standard Stack

### Core Components Already Available

| Component | Location | Purpose |
|-----------|----------|---------|
| Button | `@/components/ui/button` | Primary interaction element |
| Card | `@/components/ui/card` | Content containers |
| Select | `@/components/ui/select` | Dropdown selection (for filters) |
| Dialog | `@/components/ui/dialog` | Modal dialogs |
| Input | `@/components/ui/input` | Form inputs |
| Label | `@/components/ui/label` | Form labels |

### Components to Add (from shadcn/ui)

| Component | Purpose | Install Command |
|-----------|---------|-----------------|
| Table | Audit log display | `npx shadcn@latest add table` |
| DatePicker | Date range filter | May need additional work (uses Calendar) |

**Recommendation:** Build table manually with existing Tailwind styles rather than adding shadcn Table component - audit log is simple enough.

### Date Handling

Already installed: `date-fns` v4.1.0

Use for:
- Date formatting in audit log viewer
- Date range validation
- CSV export filename timestamps

## Architecture Patterns

### Admin Page Structure

Based on existing settings pages, follow this pattern:

```
src/app/(workspace)/[workspaceSlug]/settings/
├── admin/
│   └── page.tsx          # Admin page (audit logs + export)
├── members/
│   └── page.tsx          # Existing member management
├── page.tsx              # Settings index
└── notifications-section.tsx
```

### Admin Access Pattern

From `members/page.tsx`:
```typescript
const currentMembership = fullOrg.members?.find(
  (m) => m.userId === session.user.id
);

const canInvite =
  currentMembership?.role === "owner" ||
  currentMembership?.role === "admin";
```

Use same pattern for admin page access:
```typescript
const isAdmin = currentMembership?.role === "owner" || currentMembership?.role === "admin";
if (!isAdmin) {
  notFound(); // or redirect to settings
}
```

### Client Component Pattern for Data Fetching

For audit log viewer, use client component with fetch:

```typescript
"use client";

import { useState, useEffect } from "react";

export function AuditLogViewer({ organizationId }: Props) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/audit-logs?from=${from}&to=${to}`)
      .then(res => res.json())
      .then(data => {
        setEvents(data.events);
        setLoading(false);
      });
  }, [from, to, eventType]);

  // ... render
}
```

### CSV Export Pattern

For client-side CSV generation:

```typescript
function exportToCSV(events: AuditEvent[], filename: string) {
  const headers = ["Timestamp", "Event Type", "User ID", "IP", "Details"];
  const rows = events.map(e => [
    e.timestamp,
    e.eventType,
    e.userId || "",
    e.ip || "",
    JSON.stringify(e.details || {})
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV export | Custom server-side CSV generation | Client-side generation | Simpler, no server state, works with existing JSON API |
| Date picker | Custom date input components | Native HTML `input type="date"` | Good browser support, matches existing form patterns |
| Table virtualization | Custom virtual scroll | Simple pagination | Audit logs are small enough, API already supports pagination |

## Common Pitfalls

### Pitfall 1: Over-engineering Admin UI

**What goes wrong:** Building complex data tables with sorting, filtering, virtualization
**Why it happens:** Developer habit from complex admin dashboards
**How to avoid:** Keep it simple - basic table with pagination is sufficient for audit logs
**Warning signs:** Planning to add sorting, column resizing, row selection

### Pitfall 2: Forgetting Role Check on Admin Routes

**What goes wrong:** Admin page accessible to all authenticated users
**Why it happens:** Copy-paste from non-admin pages without adding role check
**How to avoid:** Use consistent pattern from existing admin APIs - check role === "owner" || role === "admin"
**Warning signs:** No role check in page component

### Pitfall 3: HSTS Preload Without Testing

**What goes wrong:** Setting HSTS preload flag before validating HTTPS works everywhere
**Why it happens:** Copy-paste from security guides
**How to avoid:** Only update max-age, don't add preload flag yet
**Warning signs:** Adding `includeSubDomains; preload` to HSTS header

### Pitfall 4: Breaking Logout Flow

**What goes wrong:** Logout button clears session but doesn't redirect properly
**Why it happens:** Async signOut without waiting or proper redirect
**How to avoid:** Use existing LogoutButton component which handles this correctly
**Warning signs:** Writing new logout logic instead of reusing existing component

## Code Examples

### Audit Log Table Row

```typescript
// Based on existing project patterns
function AuditLogRow({ event }: { event: AuditEvent }) {
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-2 text-sm">
        {format(new Date(event.timestamp), "MMM d, yyyy HH:mm:ss")}
      </td>
      <td className="px-4 py-2 text-sm">
        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
          {event.eventType}
        </span>
      </td>
      <td className="px-4 py-2 text-sm text-gray-600">
        {event.userId || "-"}
      </td>
      <td className="px-4 py-2 text-sm text-gray-600">
        {event.ip || "-"}
      </td>
    </tr>
  );
}
```

### Export Button

```typescript
// Pattern from existing project
function ExportDataButton({ organizationId }: { organizationId: string }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocomms-export-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading ? "Exporting..." : "Export Data (JSON)"}
    </Button>
  );
}
```

### Settings Page with Admin Section

```typescript
// Add to settings/page.tsx - conditional admin section
{isAdmin && (
  <section className="space-y-4">
    <h2 className="text-xl font-semibold">Administration</h2>
    <nav className="space-y-2">
      <Link
        href={`/${workspaceSlug}/settings/admin`}
        className="block p-4 bg-white border rounded hover:bg-gray-50"
      >
        <h3 className="font-medium">Audit Logs & Export</h3>
        <p className="text-sm text-gray-500">
          View security logs and export organization data
        </p>
      </Link>
    </nav>
  </section>
)}
```

## Implementation Order

Recommended task sequencing:

1. **UIPOL-06 (HSTS)** - One-line config change, deploy-ready immediately
2. **UIPOL-01 (Sidebar navigation)** - Verify already complete, mark done
3. **UIPOL-02 (Logout button)** - Small UI addition to sidebar
4. **UIPOL-03 (Audit log viewer)** - Larger component, builds admin foundation
5. **UIPOL-04 (Data export UI)** - Builds on admin page from UIPOL-03
6. **UIPOL-05 (USER-SETUP.md)** - Documentation, can be done in parallel

## Open Questions

1. **Audit log date picker UX**
   - What we know: Need date range filter
   - What's unclear: Should we use native date inputs or a custom date picker?
   - Recommendation: Start with native `<input type="date">`, upgrade if needed

2. **CSV export scope**
   - What we know: Need CSV export for audit logs (UIPOL-03)
   - What's unclear: Does UIPOL-04 also need CSV or is JSON sufficient?
   - Recommendation: JSON-only for data export (UIPOL-04), CSV for audit logs

3. **Admin link in sidebar vs settings**
   - What we know: Admin features need to be accessible
   - What's unclear: Should admin link be in sidebar or just in settings page?
   - Recommendation: Keep admin in settings page only (follows existing pattern)

## Sources

### Primary (HIGH confidence)
- `/Users/brett/Documents/code/ocomms/src/components/workspace/workspace-sidebar.tsx` - Direct code inspection
- `/Users/brett/Documents/code/ocomms/src/components/auth/logout-button.tsx` - Direct code inspection
- `/Users/brett/Documents/code/ocomms/src/app/api/admin/audit-logs/route.ts` - Direct code inspection
- `/Users/brett/Documents/code/ocomms/src/app/api/admin/export/route.ts` - Direct code inspection
- `/Users/brett/Documents/code/ocomms/nginx/conf.d/default.conf` - Direct code inspection
- `/Users/brett/Documents/code/ocomms/README.md` - Documentation patterns

### Secondary (MEDIUM confidence)
- Existing settings page patterns from codebase

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Direct inspection of package.json and components
- Architecture: HIGH - Direct inspection of existing patterns
- Pitfalls: HIGH - Based on actual codebase patterns
- Requirements analysis: HIGH - Direct code verification

**Research date:** 2026-01-19
**Valid until:** 30 days (stable requirements, minimal external dependencies)
