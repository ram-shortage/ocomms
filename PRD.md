# Product Requirements Document (PRD)

Project: OComms Slack-Alignment Feature Set
Date: 2026-01-24
Owner: Product + Engineering
Status: Draft

## 1) Summary
Build a set of Slack-like collaboration features for a sovereign, self-hosted Slack alternative while preserving security, privacy, and on-prem operational constraints. This PRD details requirements for new collaboration, search, workflow, audio/video, notifications, admin, integrations, file/knowledge, and quality-of-life features.

## 2) Goals
- Close key Slack feature gaps for daily team communication.
- Maintain strong security boundaries and least-privilege access.
- Preserve self-hosted, offline-friendly operation with minimal SaaS dependencies.
- Keep performance acceptable for 10k+ users per workspace on local infra.

## 3) Non-Goals
- Full Slack API parity on day one.
- Hosting of external apps or SaaS-based services as mandatory dependencies.
- Replacing the existing auth system or storage stack.

## 4) Personas
- Member: day-to-day messaging and collaboration.
- Manager/Moderator: manages channels, moderation, compliance.
- Admin/Owner: provisioning, audit, integrations, security policies.
- IT/SecOps: deployment, monitoring, data retention, exports.
- Guest: limited access to selected channels/DMs.

## 5) Assumptions
- Existing auth, org, and channel membership systems remain intact.
- Redis and PostgreSQL are available in production.
- WebSocket-based real-time events remain the primary sync mechanism.

## 6) Constraints
- Sovereign deployment: no required external SaaS dependencies.
- Security: strict authorization checks and audit trails on all sensitive actions.
- Privacy: files and messages must be access-controlled; no public URLs by default.
- Performance: avoid N+1 queries and per-message socket chatter.

## 7) Success Metrics
- Feature adoption: % of active users using new features weekly.
- Search success: % of searches resulting in a click within 10 seconds.
- Notification tuning: reduction in "mute channel" actions after adding controls.
- Operational stability: p95 API latency and socket event latency unchanged.
- Security: no increase in authz failures, no leakage via public assets.

## 8) Feature Requirements (Granular)

### 8.1 Core Collaboration

#### 8.1.1 Threads Everywhere (High)
- Description: Allow threaded replies in channels, DMs, and system messages.
- User Stories:
  - As a member, I can reply in a thread in DMs and see the thread in context.
  - As a member, I can view a thread history without loading the entire channel history.
- Functional Requirements:
  - Threadable message types: channel, DM, system messages.
  - Thread root shows reply count and last activity time.
  - Thread view supports pagination and reply composition.
  - Thread replies include same reactions and attachments as top-level messages.
  - Real-time updates for new replies (socket event per thread).
- UX Notes:
  - Inline "Replies" badge on root messages.
  - Right panel (or modal) thread view on desktop; full-screen on mobile.
- Data Model:
  - messages.parentId -> root message id; replyCount maintained on root.
- APIs/Events:
  - message:reply (create), thread:get (paged fetch).
  - message:replyCount update event.
- Security:
  - Authz uses same membership rules as parent message.
  - Guests can reply only in allowed channels/DMs.
- Acceptance Criteria:
  - Replies appear within 1 second of send for online users.
  - Reply pagination supports 50-100 per page with stable ordering.

#### 8.1.2 Message Edits + Edit History (Medium)
- Description: Users can edit messages and view edit history.
- Functional Requirements:
  - Edit window policy (configurable, default 15 minutes).
  - Store edit history with timestamps and editor id.
  - Display "edited" marker with hover to view history.
- UX Notes:
  - Edited marker in message metadata.
  - History popover with previous versions.
- Data Model:
  - message_edits table with messageId, editorId, content, editedAt.
- Security:
  - Only author (or moderator role) can edit.
  - Audit log on edits.
- Acceptance Criteria:
  - Edit history visible to members with message access.

#### 8.1.3 Reactions on Threads and Files (Medium)
- Description: Add reactions to thread replies and file objects.
- Functional Requirements:
  - Reactions on any message including thread replies.
  - Reactions on files (file preview panel).
- Data Model:
  - reactions table should include targetType (message|file) and targetId.
- Acceptance Criteria:
  - Reaction toggles in < 300ms locally and syncs on socket.

#### 8.1.4 Message Forwarding / Quote Reply (Medium)
- Description: Forward or quote a message to another channel/DM.
- Functional Requirements:
  - Quote preserves author, timestamp, and link back to original.
  - Forward respects permission checks on target.
- Security:
  - If target lacks access to original, content must be redacted or blocked.
- Acceptance Criteria:
  - Quote includes backlink and is immutable.

### 8.2 Search and Discovery

#### 8.2.1 Unified Global Search (High)
- Description: Search across messages, files, people, channels, notes.
- Functional Requirements:
  - Single search input with result tabs.
  - Search respects workspace membership and channel/DM permissions.
  - Full-text indexing with PostgreSQL GIN or external index if available.
- UX Notes:
  - Typeahead suggestions for channels and users.
- Data Model:
  - Search index on messages, files, notes.
- Acceptance Criteria:
  - p95 search response < 800ms for 1M messages.

#### 8.2.2 Advanced Filters (Medium)
- Description: Support filter syntax: from:, in:, has:link, has:file, date ranges.
- Functional Requirements:
  - Filter parser and validation.
  - UI chips representing parsed filters.
- Acceptance Criteria:
  - Filters are reflected in results and shareable via URL.

#### 8.2.3 Saved Searches and Alerts (Medium)
- Description: Save queries and optionally receive alerts on new matches.
- Functional Requirements:
  - Saved queries per user with optional notifications.
  - Alert delivery via in-app notifications and optional email.
- Security:
  - Saved queries only visible to the owner.
- Acceptance Criteria:
  - Alerts fire within 1 minute of match creation.

### 8.3 Workflow and Organization

#### 8.3.1 Pins + Pinned View (Low)
- Description: Pin messages per channel/DM.
- Functional Requirements:
  - Pin/unpin action with permission checks.
  - Pinned list view sorted by pinnedAt.
- Data Model:
  - channel_pins table (channelId, messageId, pinnedBy, pinnedAt).

#### 8.3.2 Bookmarks per Channel (Medium)
- Description: Channel-scoped bookmarks to external or internal URLs.
- Functional Requirements:
  - Create/edit/delete bookmarks with title, URL, optional description.
  - Pin bookmarks to channel header.
- Security:
  - Bookmark creation limited to members; delete restricted to role or creator.

#### 8.3.3 Save for Later + Reminders (Medium)
- Description: Save messages with optional due date and reminders.
- Functional Requirements:
  - Saved items list per user.
  - Scheduled reminder notifications.
- Data Model:
  - saved_items table with reminderAt, status.

#### 8.3.4 Scheduled Messages Queue (Medium)
- Description: View and manage scheduled messages by channel.
- Functional Requirements:
  - List upcoming scheduled messages per channel.
  - Edit or cancel before send.
- Security:
  - Only author or moderator can edit/cancel.

### 8.4 Voice and Video (Optional)

#### 8.4.1 Huddles with Screen Share (Very High)
- Description: Lightweight voice rooms with optional screen share.
- Functional Requirements:
  - Start/stop huddle in a channel/DM.
  - Join/leave, mute/unmute, device selection.
  - Screen sharing with permission prompts.
- Tech Notes:
  - WebRTC + TURN/STUN self-hosted required.
- Security:
  - Access limited to channel/DM membership.
  - No recording by default; if enabled, requires admin policy.

#### 8.4.2 Call-in via Browser or SIP (Very High)
- Description: Optional SIP gateway for phone dial-in.
- Requirements:
  - SIP integration with local PBX.
  - Access control via PIN or invite links.

### 8.5 Notifications

#### 8.5.1 Per-Channel Notification Settings (Medium)
- Description: Configure per-channel notifications: all, mentions, none.
- Requirements:
  - Default workspace-level setting with per-channel override.
  - UI in channel settings.

#### 8.5.2 Keyword Notifications + DND (Medium)
- Description: Alert on user-defined keywords and define DND windows.
- Requirements:
  - Per-user keyword list with case-insensitive matching.
  - Scheduled DND with override for mentions.

#### 8.5.3 Push/Desktop Controls (Medium)
- Description: Granular settings for push and desktop notifications.
- Requirements:
  - Separate toggles for push, desktop, sound.
  - Quiet hours for mobile.

### 8.6 User and Workspace Management

#### 8.6.1 Granular Roles (High)
- Description: Introduce Owner/Admin/Moderator/Member/Guest role matrix.
- Requirements:
  - Role-based permissions on actions (delete, edit, pin, invite, export).
  - UI to manage roles with audit logs.
- Security:
  - Default least-privilege; explicit elevation required.

#### 8.6.2 SCIM + SSO (High)
- Description: Enterprise provisioning and SSO (SAML/OIDC).
- Requirements:
  - SCIM endpoints for user/group lifecycle.
  - SSO login with fallback local auth.
- Security:
  - Signed assertions; enforced domain restrictions.

#### 8.6.3 Audit Log UI + Export (Medium)
- Description: Display and export audit events.
- Requirements:
  - UI filters by actor, event type, date.
  - CSV/JSON export.
- Security:
  - Access restricted to Admin/Owner.

### 8.7 Integrations

#### 8.7.1 Webhooks (Medium)
- Description: Incoming and outgoing webhooks.
- Requirements:
  - Incoming webhook URLs with secret tokens.
  - Outgoing webhooks for message events.
- Security:
  - Rate limits and signature verification.

#### 8.7.2 Bot Framework + Slash Commands (High)
- Description: Bots that can read/post in channels and DMs.
- Requirements:
  - Bot accounts with scoped permissions.
  - Slash commands with request/response and interactive messages.

#### 8.7.3 App Directory + Permissions (High)
- Description: Manage installed apps and their scopes.
- Requirements:
  - Admin approval workflow.
  - Permission review screen with scope list.

#### 8.7.4 Email to Channel (Medium)
- Description: Ingest email into channels.
- Requirements:
  - Per-channel email address with configurable sender allowlist.
  - HTML sanitization and attachment handling.

### 8.8 Files and Knowledge

#### 8.8.1 File Previews + Versioning (Medium)
- Description: Preview files and manage versions.
- Requirements:
  - PDF and image previews.
  - Upload new versions with history.
- Data Model:
  - file_versions table with checksum and version number.

#### 8.8.2 File Permissions by Channel/DM (High)
- Description: Restrict file access by channel/DM membership.
- Requirements:
  - Serve files through authorized endpoints (no public URLs).
  - Cache headers set to private.

#### 8.8.3 Retention Policies + Legal Hold (High)
- Description: Admin-configured retention policies and legal hold.
- Requirements:
  - Policy by workspace or channel.
  - Legal hold exceptions override retention.
  - Export tools for compliance.

### 8.9 Quality-of-Life

#### 8.9.1 Drafts per Channel/DM (Medium)
- Description: Persist drafts per conversation.
- Requirements:
  - Local persistence with optional server sync.
  - Drafts restored on device reload.

#### 8.9.2 Typing Indicators for Threads (Low)
- Description: Show typing status within thread view.
- Requirements:
  - Thread-level typing events and throttle to avoid spam.

#### 8.9.3 Message Formatting Toolbar (Low)
- Description: UI for formatting markdown.
- Requirements:
  - Bold/italic/code/link buttons.
  - Shortcut hints.

#### 8.9.4 Emoji Status + Expiration (Low)
- Description: Set a status emoji + text with optional expiration.
- Requirements:
  - Status visible in profile and chat list.
  - Expired status auto-clears.

## 9) Security and Privacy Requirements
- All new write operations must be audited.
- No new public file endpoints; access must be authorized per request.
- Webhooks require HMAC signatures; rate limit by token.
- SSO and SCIM endpoints must be protected and logged.
- Message edits and deletes should preserve immutable audit events.

## 10) Data Model Additions (High-level)
- message_edits
- channel_pins
- bookmarks
- saved_items
- scheduled_messages (per-channel queue view)
- file_versions
- roles/permissions tables
- saved_searches
- notification_settings (per user + per channel)

## 11) API and Socket Additions (High-level)
- message:edit, message:forward, thread:get, thread:typing
- reaction:toggle (extended to files)
- search:query (with filters)
- bookmarks CRUD, pins CRUD
- saved_searches CRUD, alerts
- notifications:settings CRUD
- integrations: webhooks, bots, apps

## 12) Rollout Plan
- Phase 1: Threads everywhere, edits, pins, drafts.
- Phase 2: Search upgrades, saved items, bookmarks, scheduled queue.
- Phase 3: Notifications, roles, audit UI, integrations.
- Phase 4: File permissions + retention, voice/video.

## 13) Risks
- Increased query load from search and thread expansion.
- Permission complexity in roles and file access.
- WebRTC/voice adds operational complexity (TURN).

## 14) Open Questions
- Which features must ship first for enterprise pilots?
- What retention policies are required by default?
- Should message edits be allowed for guests?

