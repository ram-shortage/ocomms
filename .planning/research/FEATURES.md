# Feature Landscape: Self-Hosted Team Chat Platform

**Domain:** Self-hosted Slack-like team communication platform
**Milestone:** Full Conversation (v1.0)
**Researched:** 2026-01-17
**Confidence:** HIGH (verified against Slack, Mattermost, Rocket.Chat, Zulip documentation and industry analysis)

---

## Executive Summary

Team chat has matured significantly. What was differentiating in 2015 is table stakes in 2026. Users expect channels, threads, search, mentions, and emoji reactions as baseline functionality. The self-hosted market has specific expectations around data control, compliance, and deployment flexibility that cloud-only solutions cannot match.

For OComms v1.0 "Full Conversation" milestone, the planned feature set aligns well with table stakes requirements. The key is execution quality, particularly around real-time performance, search accuracy, and notification reliability.

---

## Table Stakes Features

Features users expect. Missing any of these = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | In Milestone 1? | Notes |
|---------|--------------|------------|-----------------|-------|
| **Channels (public/private)** | Core organizing principle since Slack popularized it. Every competitor has this. | Medium | Yes (1.1) | Must include create, join, leave, directory |
| **Direct Messages** | 1:1 and group DMs are fundamental communication pattern | Low-Medium | Yes (core) | Group DMs often overlooked but essential |
| **Threading** | Reduces channel noise, enables async work. Expected since 2017. | High | Yes (1.2) | Single-level threading (not nested). "Reply also to channel" option critical |
| **Real-time delivery** | Messages must appear instantly. Sub-second latency expected. | High | Yes (core) | WebSocket-based. This is the product. |
| **Message search** | "Finding files is table stakes, but finding them later is what really matters" | High | Yes (2.1) | Full-text across messages minimum |
| **@mentions** | @person, @channel, @here are standard vocabulary | Low | Yes (3.3) | Notification integration critical |
| **Emoji reactions** | Standard since 2016. Replaces "I agree" messages, enables voting | Low-Medium | Yes (4.1) | Standard emoji set required; custom emoji expected |
| **Presence indicators** | Active/away dot next to names. Auto-detected from activity. | Medium | Yes (3.2) | Auto-away after 10 min inactivity is standard |
| **Notification controls** | Per-channel mute, DND, mention-only options | Medium | Yes (3.1) | Mobile push must work reliably |
| **Unread management** | Unread counts, mark as read/unread, catch-up experience | Medium | Yes (3.4) | "Mark unread" is critical for task management |
| **Mobile access** | Web + mobile apps expected | High | Partial | Responsive web minimum; native apps eventually |
| **User profiles** | Display name, avatar, status, contact info | Low | Yes (core) | Foundation for presence and mentions |
| **Channel topic/description** | Context for what channel is about | Low | Yes (1.3) | Often displayed in channel header |

### Self-Hosted Specific Table Stakes

| Feature | Why Expected | Complexity | In Milestone 1? | Notes |
|---------|--------------|------------|-----------------|-------|
| **Data sovereignty** | Primary reason for self-hosting. All data on customer infrastructure. | Low (architectural) | Yes (core) | No telemetry to external services |
| **Standard auth** | LDAP/AD integration, SSO (SAML/OIDC) | High | Post-v1 | Can start with email/password, but enterprise needs this |
| **Docker deployment** | Standard deployment method for self-hosted software | Medium | Yes | docker-compose minimum |
| **Backup/restore** | Data protection is customer responsibility | Medium | Yes | Clear documentation + tooling |
| **Retention policies** | Compliance requirement for many organizations | Medium | Post-v1 | Important for regulated industries |

---

## Differentiators

Features that set product apart. Not expected, but valued. For self-hosted, some become differentiators vs SaaS.

| Feature | Value Proposition | Complexity | In Milestone 1? | Notes |
|---------|-------------------|------------|-----------------|-------|
| **Power search with modifiers** | `in:`, `from:`, `before:`, `after:`, `has:` operators | High | Yes (2.1) | Slack-level search. Major DX improvement. |
| **Custom emoji** | Team culture building, practical status indicators | Medium | Yes (4.1) | Upload + management UI |
| **Notification schedules** | Recurring DND (e.g., "quiet hours 8pm-7am weekdays") | Medium | Yes (3.1) | Respects async work patterns |
| **Pins + bookmarks** | Pins = team reference; Bookmarks = personal | Low | Yes (1.4) | Separate concepts in Slack |
| **Thread notifications** | Follow/unfollow threads, "All Threads" view | Medium | Yes (1.2) | Zulip pioneered; Slack adopted |
| **Custom status** | Emoji + text (e.g., "Vacationing in Hawaii") | Low | Yes (3.2) | Expiration time is nice-to-have |
| **Drafts** | Auto-save unsent messages per conversation | Medium | Yes (3.4) | Prevents lost work |
| **Unreads view** | Aggregated view of all unread across channels | Medium | Yes (3.4) | Inbox-zero for chat |

### Self-Hosted Differentiators (vs Slack/Teams)

| Feature | Value Proposition | Complexity | Priority |
|---------|-------------------|------------|----------|
| **Zero external dependencies** | Air-gapped deployment possible | High | v1.0 |
| **Simple deployment** | One command to deploy (vs Mattermost complexity) | Medium | v1.0 |
| **Transparent pricing** | No per-seat licensing surprises | N/A | v1.0 |
| **Full API access** | Build custom integrations without enterprise tier | Medium | v1.5 |
| **Data export** | Complete data portability in standard formats | Medium | v1.0 |
| **Resource efficiency** | Run on modest hardware (vs Rocket.Chat needs) | High | v1.0 |

---

## Anti-Features

Features to explicitly NOT build in v1.0. Either because they're scope creep, complexity traps, or actively harmful to focus.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **AI summaries/Q&A** | Requires external API dependencies (OpenAI, etc.), breaks self-hosted value prop, massive scope | Defer to v2. Make architecture AI-ready but don't implement. |
| **Video/audio calls (Huddles)** | Extremely complex (WebRTC, TURN servers, bandwidth). Mattermost requires plugins for this. | Integrate with existing solutions (Jitsi link) or defer to v2. |
| **Workflow Builder** | Complex automation engine. Enterprise feature that took Slack years. | Start with simple integrations. Webhooks first. |
| **Shared channels (external)** | Federation is architecturally complex. Rocket.Chat uses Matrix for this. | Focus on single-org experience first. |
| **Omnichannel inbox** | Customer support feature (Rocket.Chat specialty). Different product. | Stay focused on internal team chat. |
| **Canvas/Docs** | Document editor is separate product. Compete with Notion if you want. | Link to external docs. |
| **Lists/Tasks** | Task management is separate product. Compete with Linear/Jira if you want. | Integrate with existing tools. |
| **Message scheduling** | Nice-to-have, not essential. Adds complexity to message model. | Defer to v1.5+. |
| **Nested threading** | No major platform does this. Adds significant complexity. Reddit-style threads failed. | Single-level threading only. |
| **Read receipts** | Privacy concerns, anxiety-inducing, complex at scale | Not implementing. Presence is enough. |
| **Typing indicators (cross-channel)** | Performance cost at scale, limited value | Per-conversation only, if at all |

### Complexity Traps to Avoid

| Trap | Why It's Tempting | Why It's Dangerous |
|------|-------------------|-------------------|
| **"Just add real-time sync for X"** | Seems simple | Real-time is hard. Each synced entity adds complexity. |
| **"Users need advanced permissions"** | Enterprise feature | RBAC is a rabbit hole. Start with simple roles (member/admin/owner). |
| **"Support all notification channels"** | Completeness | Email, push, SMS, desktop = 4x testing surface. Pick 2 for v1. |
| **"Import from Slack"** | Migration path | Slack export format is complex. Do it well later or not at all. |
| **"Theme customization"** | Personal preference | CSS theming is scope creep. Ship one good theme. |

---

## Feature Dependencies

Understanding what must come before what.

```
Core Infrastructure (prerequisite for everything)
  |
  +-- User/Workspace/Member model
  |     |
  |     +-- Channels (requires Members)
  |     |     |
  |     |     +-- Channel Settings (requires Channels)
  |     |     +-- Channel Topic/Description (requires Channels)
  |     |     +-- Pins/Bookmarks (requires Channels + Messages)
  |     |
  |     +-- Direct Messages (requires Members)
  |
  +-- Messages (requires Channels OR DMs)
        |
        +-- Threads (requires Messages)
        |     |
        |     +-- Thread Notifications (requires Threads + Notification System)
        |
        +-- Mentions (requires Messages + Members)
        |     |
        |     +-- @channel/@here (requires Mentions + Channel Membership)
        |
        +-- Emoji Reactions (requires Messages)
        |     |
        |     +-- Custom Emoji (requires Emoji Reactions + Upload System)
        |
        +-- Search (requires Messages + indexing infrastructure)
              |
              +-- Search Modifiers (requires Search)

Notification System (can be built in parallel)
  |
  +-- Basic Notifications (requires Messages + Mentions)
  |
  +-- DND (requires Notifications)
  |     |
  |     +-- Notification Schedules (requires DND)
  |
  +-- Per-channel Settings (requires Notifications + Channels)

Presence System (can be built in parallel)
  |
  +-- Active/Away Detection (requires User Sessions)
  |
  +-- Custom Status (requires Presence)

Read State System (can be built in parallel)
  |
  +-- Unread Counts (requires Messages + per-user state)
  |
  +-- Mark Read/Unread (requires Unread Counts)
  |
  +-- Drafts (requires Messages, independent of read state)
  |
  +-- Unreads View (requires Unread Counts aggregation)
```

### Critical Path for v1.0

1. **Foundation:** User model, auth, workspaces, members
2. **Core Messaging:** Channels, DMs, messages, real-time delivery
3. **Threading:** Replies, thread panel, "also send to channel"
4. **Mentions & Notifications:** @mentions, basic notification delivery
5. **Search:** Full-text search with modifiers
6. **Polish:** Reactions, status, pins, DND, drafts

---

## MVP Recommendation

For the "Full Conversation" milestone (v1.0), the planned feature set is appropriate. Prioritization within the milestone:

### Must Ship (MVP Core)

These features define whether the product is usable for daily team communication:

1. **Workspaces, Members, Channels, DMs** - The container model
2. **Real-time messaging** - The core experience
3. **Threading** - Expected since 2017
4. **@mentions with notifications** - Core communication pattern
5. **Basic search** - Finding past messages
6. **Presence (active/away)** - Knowing who's around
7. **Unread management** - Catch-up experience

### Should Ship (MVP Complete)

Features that round out the experience:

8. **Channel topic/description** - Context for channels
9. **Emoji reactions** - Standard emoji, voting, acknowledgment
10. **DND + schedules** - Respecting focus time
11. **Power search modifiers** - `in:`, `from:`, `before:`, `after:`
12. **Pins** - Team reference material
13. **Custom status** - Where are you, what are you doing
14. **Mark unread + drafts** - Task management patterns

### Could Defer (Nice-to-Have)

15. **Custom emoji** - Can ship standard set first
16. **Bookmarks (personal)** - Pins cover team needs
17. **@everyone** - Controversial feature, can add later
18. **Unreads aggregated view** - Can use sidebar counts

---

## Competitive Positioning

| Aspect | Slack | Mattermost | Rocket.Chat | OComms Target |
|--------|-------|------------|-------------|---------------|
| **Hosting** | Cloud only | Self-hosted + cloud | Self-hosted + cloud | Self-hosted only |
| **Pricing** | Per-seat, expensive | Per-seat, complex tiers | Per-seat, cheaper | Transparent/simple |
| **Complexity** | N/A (SaaS) | High (plugins needed) | High (many options) | Simple (it works) |
| **Target** | Everyone | DevOps, enterprises | Omnichannel, gov | Teams wanting control |
| **AI Features** | Heavy | Moderate | Growing | Deferred (v2) |

### OComms Positioning

**For teams who:**
- Want full data control without SaaS complexity
- Need Slack-quality UX without Slack pricing
- Value simplicity over feature bloat
- Want to self-host without DevOps expertise

**Not for teams who:**
- Need AI features today
- Need video calls built-in
- Need omnichannel customer support
- Need cross-organization federation

---

## Sources

### Primary Sources (HIGH confidence)
- [Slack Features Overview](https://slack.com/features)
- [Slack Help: Threading](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions)
- [Slack Help: Search](https://slack.com/help/articles/202528808-Search-in-Slack)
- [Slack Help: Status and Availability](https://slack.com/help/articles/201864558-Set-your-Slack-status-and-availability)
- [Slack Help: Pins and Bookmarks](https://slack.com/help/articles/205239997-Pin-messages-and-bookmark-links)
- [Slack Design: Threads Journey](https://slack.design/articles/threads-in-slack-a-long-design-journey-part-1-of-2/)

### Competitor Analysis (MEDIUM-HIGH confidence)
- [Mattermost vs Rocket.Chat Comparison](https://mattermost.com/mattermost-vs-rocketchat/)
- [Self-Hosted Slack Alternatives Comparison](https://wz-it.com/en/blog/slack-alternatives-mattermost-rocketchat-zulip/)
- [Open Source Team Chat Tools](https://www.slackalternative.com/blog/open-source-team-chat-tools)
- [Rocket.Chat: Why Self-Hosted](https://opensource.com/article/22/1/rocketchat-data-privacy)

### Industry Analysis (MEDIUM confidence)
- [Team Chat Apps 2025](https://learn.g2.com/best-team-chat-apps)
- [Enterprise Messaging Platforms](https://www.zenzap.co/blog-posts/top-10-enterprise-messaging-platforms-for-fast-growing-teams-zenzap-vs-the-rest)
- [Why Self-Host Chat](https://www.rst.software/blog/self-hosted-chat)
- [Slack Best Practices](https://getculturebot.com/blog/slack-best-practices-for-remote-teams/)

### Feature-Specific (MEDIUM confidence)
- [Emoji in Workplace Communication](https://slack.com/blog/collaboration/emoji-use-at-work)
- [Microsoft Teams Notifications Guide](https://blog.virtosoftware.com/microsoft-teams-notifications-guide/)
- [Slack Search Tips](https://www.makeuseof.com/tag/11-advanced-slack-search-tips-that-you-should-be-using-now/)
