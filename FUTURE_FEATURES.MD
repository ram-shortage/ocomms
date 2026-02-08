**Core collaboration**
- Threads everywhere (threaded replies for DMs and system messages too, not just channels) - Complexity: High
- Message edits with edit history + hover "edited" marker - Complexity: Medium
- Reactions on threads and files (not just messages) - Complexity: Medium
- Message forwarding / quote-reply across channels - Complexity: Medium

**Search & discovery**
- Unified global search: messages, files, people, channels, notes - Complexity: High
- Advanced filters: `from:`, `in:`, `has:link`, `has:file`, date ranges - Complexity: Medium
- Saved searches + search alerts - Complexity: Medium

**Workflow & organization**
- Message pins with pinned view per channel/DM - Complexity: Low
- Bookmarks per channel (links, docs, dashboards) - Complexity: Medium
- Message "Save for later" with due dates + reminders - Complexity: Medium
- Scheduled messages with per-channel schedule queue - Complexity: Medium

**Voice & video (optional)**
- Huddles (lightweight voice) with screen sharing - Complexity: Very High
- Call-in via browser or SIP (for enterprise self-hosted) - Complexity: Very High

**Notifications**
- Per-channel notification settings (all, mentions, nothing) - Complexity: Medium
- Keyword notifications + personal do-not-disturb schedules - Complexity: Medium
- Mobile push and desktop notifications with granular controls - Complexity: Medium

**User & workspace management**
- Granular roles (Owner/Admin/Moderator/Member/Guest) - Complexity: High
- SCIM provisioning + SSO (SAML/OIDC) for enterprise - Complexity: High
- Audit log UI + export (you already have core audit logging) - Complexity: Medium

**Integrations**
- Webhooks (incoming/outgoing) - Complexity: Medium
- Bot framework + slash commands - Complexity: High
- App directory + permissions model - Complexity: High
- Email to channel (ingest) - Complexity: Medium

**Files & knowledge**
- File previews (PDF, images) and versioning - Complexity: Medium
- File permissions by channel/DM - Complexity: High
- Content retention policies + legal hold (optional, enterprise) - Complexity: High

**Quality-of-life**
- Drafts per channel/DM - Complexity: Medium
- Typing indicators for threads - Complexity: Low
- Message formatting toolbar (Markdown help, code blocks) - Complexity: Low
- Emoji status + custom statuses with expiration - Complexity: Low
