# Feature Landscape: v0.5.0 Feature Completeness

**Domain:** Self-hosted team communication platform (Slack/Discord/Teams alternative)
**Researched:** 2026-01-20
**Overall Confidence:** HIGH (verified against official Slack, Discord, Teams documentation and implementation patterns)

---

## Executive Summary

This research covers 12 feature areas planned for OComms v0.5.0. Each feature is analyzed against how Slack, Discord, Microsoft Teams, Mattermost, and similar platforms implement them. Features are categorized as table stakes (must-have for user acceptance), differentiators (competitive advantage), or anti-features (things to deliberately NOT build).

**Key findings:**
- Most features have well-established patterns from Slack that users expect
- Link unfurling and typing indicators have significant technical complexity
- Guest accounts and user groups are premium Slack features worth implementing for enterprise use cases
- Workspace analytics should focus on actionable metrics, not surveillance

---

## Feature 1: User Status Messages

**Slack Reference:** Users can set emoji + text status (up to 100 characters) with optional expiration time.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Custom emoji + text status | Slack established this pattern universally | Low | Store in members table |
| Status visible next to name | Users expect to see status on profiles and mentions | Low | Display emoji in member lists, message headers |
| Status expiration | "In a meeting until 3pm" is the core use case | Medium | Need scheduled job or lazy evaluation |
| Preset status options | Reduces friction for common statuses | Low | "In a meeting", "Out sick", "On vacation", "Focusing" |
| Manual status clear | User control over their status | Low | Button to clear immediately |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pause notifications with status | "Do not disturb until status clears" | Medium | Integrate with notification preferences |
| Admin-customizable presets | Org-specific statuses ("WFH", "Field visit") | Low | Workspace-level configuration |
| Status sync with calendar | Auto-set "In a meeting" from calendar | High | Requires external integration - defer |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Activity-based auto-status (like Discord) | Gaming focus doesn't fit team communication | Keep simple emoji + text pattern |
| Rich presence (sharing app/music) | Privacy concerns, not relevant for work context | Status is user-controlled only |
| Mandatory status updates | Surveillance feeling, hurts adoption | Status is optional |

**Recommendation:** Implement Slack-style status with emoji, text, and expiration. The pattern is well-understood and expected.

**Sources:**
- [Slack: Set your status and availability](https://slack.com/help/articles/201864558-Set-your-Slack-status-and-availability)
- [Discord: Custom Status](https://support.discord.com/hc/en-us/articles/360035407531-Custom-Status)

---

## Feature 2: Bookmarks / Saved Messages

**Slack Reference:** Users can bookmark any message or file to a private "Saved" list (recently renamed to "Later").

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Save any message to personal list | Core functionality users expect | Low | Junction table: user_id, message_id |
| Save files | Files need saving too | Low | Same pattern as messages |
| View all saved items in one place | Must be easily accessible | Low | Sidebar item or modal |
| Remove saved item | User control | Low | Delete from junction table |
| Jump to original context | Click saved item to see it in channel | Low | Navigate to message location |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Organize saved items (folders/tags) | Power users want organization | Medium | Adds complexity, defer to later |
| Reminder on saved item | "Remind me about this in 2 hours" | Medium | Overlaps with Reminders feature |
| Share saved items collection | Team knowledge curation | High | Different product direction |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Public saved items | Private by design, not a curation tool | Keep saved items private only |
| Auto-save based on keywords | Noise, not useful | User-initiated only |
| Saved items limit | Artificial friction | Allow unlimited saves |

**Recommendation:** Simple save/unsave with a sidebar view. The feature is straightforward - don't overcomplicate it.

**Sources:**
- [Slack: Save messages and files for later](https://slack.com/help/articles/360042650274-Save-messages-and-files-for-later)

---

## Feature 3: Scheduled Messages

**Slack Reference:** "Send later" with date/time picker. Messages visible in Drafts & Sent view until delivered.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Schedule message for specific date/time | Core feature users expect | Medium | Separate scheduled_messages table |
| View/edit scheduled messages | User control before send | Low | List view with edit capability |
| Cancel scheduled message | User control | Low | Delete from table |
| Send to channels and DMs | Works everywhere messages work | Low | Same as regular messages |
| Timezone-aware scheduling | Global teams need this | Medium | Store in UTC, display in user TZ |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Suggested send times | "Tomorrow 9am" quick picks | Low | UI convenience |
| Recurring scheduled messages | Weekly standup reminders | High | Requires workflow-like system - Slack uses Workflow Builder for this |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Scheduled thread replies | Slack doesn't support this, odd UX | Only support channel/DM scheduling |
| Complex recurrence rules | Workflow builder territory | Keep to one-time scheduling |
| Schedule on behalf of others | Permission nightmare | Only schedule own messages |

**Recommendation:** Implement one-time scheduling with simple UI. Recurring messages are a workflow feature, not a messaging feature.

**Technical Note:** Need a scheduled job runner to process scheduled messages. Options: Node cron job, database-level scheduling with pg_cron, or simple polling interval.

**Sources:**
- [Slack: Send and read messages](https://slack.com/help/articles/201457107-Send-and-read-messages)
- [Slack Developer Docs: Sending and scheduling messages](https://docs.slack.dev/messaging/sending-and-scheduling-messages/)

---

## Feature 4: Reminders

**Slack Reference:** `/remind` slash command creates Slackbot DM reminders. Can remind self, others, or channels.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Remind self about a message | "Remind me about this in 2 hours" | Medium | Link reminder to specific message |
| Remind at specific time | Core functionality | Medium | Scheduled notification delivery |
| View all pending reminders | User management | Low | List view |
| Mark reminder complete | User control | Low | Status update |
| Snooze reminder | Common need when reminder fires | Low | Reschedule to new time |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Remind about any message | Right-click "Remind me" | Low | Best UX for message-based reminders |
| Recurring reminders | "Every Monday at 9am" | Medium | Adds complexity but high value |
| `/remind` slash command | Power user efficiency | Medium | Requires slash command infrastructure |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Remind other users | Notification spam, permission issues | Only remind self |
| Channel reminders (visible to all) | Use scheduled messages instead | Reminders are private |
| Natural language parsing | High complexity, error-prone | Use explicit date/time picker |

**Recommendation:** Start with message-based reminders ("Remind me about this"). Slash command and arbitrary reminders can come later.

**Key Difference from Scheduled Messages:**
- Scheduled messages: Send a message to others at a specific time
- Reminders: Notify yourself about something at a specific time (private)

**Sources:**
- [Slack: Set a reminder](https://slack.com/help/articles/208423427-Set-a-reminder)
- [Slack: How to use reminders](https://slack.com/resources/using-slack/how-to-use-reminders-in-slack)

---

## Feature 5: User Groups (@team mentions)

**Slack Reference:** Create named groups (e.g., @designers) that notify all members when mentioned. Premium feature.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create named user group | Core functionality | Medium | New table with members relationship |
| @mention group to notify all members | The whole point | Medium | Expand group to individual notifications |
| View group members | Transparency | Low | Click @group to see members |
| Add/remove members | Management | Low | Admin UI |
| Group handle uniqueness | Avoid confusion | Low | Unique constraint |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Default channels for group | Auto-add new members to channels | Medium | Nice for onboarding |
| Nested groups | @engineering includes @frontend and @backend | High | Complexity explosion - avoid |
| Self-service group joining | Reduces admin burden | Low | Permission setting per group |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| @group mention creates DM | Confusing, unexpected | Mention notifies in current channel |
| Guests in user groups | Slack explicitly doesn't allow this | Groups are internal only |
| Unlimited group creation | Can become spam | Admin-controlled or rate-limited |
| Nested/hierarchical groups | Complexity trap | Flat groups only |

**Recommendation:** Flat user groups with admin control over creation. Keep it simple - groups expand to member notifications.

**Implementation Note:** When @group is mentioned in a channel, only notify group members who are also channel members. Slackbot warns about members not in channel.

**Sources:**
- [Slack: Create a user group](https://slack.com/help/articles/212906697-Create-a-user-group)
- [Atlassian: Why Slack user groups are awesome](https://www.atlassian.com/blog/halp/why-slack-user-groups-are-awesome-and-how-to-utilize-them)

---

## Feature 6: Channel Categories / Folders

**Discord Reference:** Channels organized under collapsible categories with shared permissions.
**Teams Reference:** New "Sections" feature (2025) for organizing chats and channels.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Group channels under named category | Core organization need | Medium | Add category_id to channels |
| Collapse/expand categories | UI essential | Low | Client-side state |
| Drag channels between categories | Reordering | Medium | Update category_id and sort_order |
| Uncategorized channels section | Backward compatibility | Low | Null category_id |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Category-level permissions | Discord's killer feature | High | Adds permission complexity |
| Personal category organization | User customizes their own view | High | Per-user state, sync issues |
| Default categories for new workspaces | Onboarding help | Low | Template system |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Nested categories | Categories within categories | Single level only (Discord pattern) |
| Required category assignment | Some channels don't need categorization | Allow uncategorized |
| Admin-only category management | Teams need flexibility | Allow members to create (with limits) |

**Recommendation:** Implement Discord-style categories: single level, collapsible, with drag-drop reordering. Skip per-category permissions initially (adds significant complexity).

**Sources:**
- [Discord: Channel Categories 101](https://support.discord.com/hc/en-us/articles/115001580171-Channel-Categories-101)
- [Microsoft: Organize Teams with Sections](https://www.withum.com/resources/organize-microsoft-teams-chats-and-channels-with-sections/)

---

## Feature 7: Link Previews / Unfurling

**Slack Reference:** Automatic rich previews for URLs using Open Graph and Twitter Card metadata.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fetch Open Graph metadata | Standard protocol | Medium | Server-side URL fetching |
| Display title, description, image | Core preview | Medium | Parse og:title, og:description, og:image |
| One preview per link (first 5 links max) | Slack behavior | Low | Limit renders |
| Clickable preview to open URL | Expected behavior | Low | Wrap in anchor |
| Preview caching | Performance | Medium | Cache metadata for repeated URLs |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Twitter Card fallback | Better coverage | Low | Check twitter: tags if og: missing |
| User can dismiss preview | UI preference | Low | Remove preview client-side |
| App-specific unfurling (YouTube, Twitter, etc.) | Richer previews | High | Per-domain handlers |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-play video previews | Bandwidth, annoying | Static thumbnails only |
| Full article embedding | Copyright issues, complexity | Link + preview only |
| Unfurl internal links to messages | Complex message-within-message | Link only, no recursive unfurl |

**Recommendation:** Implement Open Graph + Twitter Card fetching with caching. Skip domain-specific handlers initially.

**Technical Considerations:**
- Fetch only first 32KB of HTML (Slack's approach) to avoid large pages
- Use Range header for partial fetch
- Rate limit outbound requests
- Cache aggressively (URLs don't change often)
- Run fetching async, don't block message send
- Respect robots.txt and noindex

**Sources:**
- [Slack: Share links and set preview preferences](https://slack.com/help/articles/204399343-Share-links-and-set-preview-preferences)
- [Slack Developer Docs: Unfurling links](https://docs.slack.dev/messaging/unfurling-links-in-messages/)
- [OpenGraph.io: Ultimate Guide to Link Unfurling](https://www.opengraph.io/unfurl-url)

---

## Feature 8: Typing Indicators

**Slack Reference:** Shows "[Name] is typing..." at bottom of channel when user is composing.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Show when someone is typing | Core feature | Medium | WebSocket event broadcast |
| Show who is typing | Multiple simultaneous typers | Medium | Track list of typing users |
| Auto-hide after timeout | User stopped typing | Low | 5-second timeout (Slack standard) |
| Hide when message sent | Immediate feedback | Low | Clear on message receipt |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Typing in threads | Thread-specific indicator | Medium | Scope to parent message |
| User preference to disable | Privacy choice | Low | Client-side setting |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Read receipts | Privacy nightmare, user backlash | Typing indicators only |
| "Last seen" timestamps | Surveillance feeling | Stick to presence (active/away) |
| Typing indicator for bots | Confusing, unnecessary | User messages only |

**Recommendation:** Implement with throttling (send event max once per 1-3 seconds) and 5-second auto-hide.

**Technical Considerations:**
- Throttle typing events: don't send on every keystroke
- Use WebSocket broadcast scoped to channel/DM
- With Redis pub-sub, broadcast to all server instances
- Don't persist typing state - ephemeral only
- Scale concern: busy channels with many typers need UI handling

**Sources:**
- [Slack Developer Docs: user_typing event](https://docs.slack.dev/reference/events/user_typing/)
- [Medium: Building Scalable Real-Time Typing Indicator System](https://medium.com/@ramesh200212/building-a-scalable-real-time-typing-indicator-system-a-deep-dive-into-distributed-architecture-5f14b331c4ab)

---

## Feature 9: Custom Emoji

**Slack/Mattermost Reference:** Upload custom images as emoji usable in messages and reactions.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upload custom emoji image | Core functionality | Medium | File storage + metadata |
| Use in messages and reactions | Anywhere emoji work | Medium | Integrate with emoji picker |
| Unique emoji names | :custom-emoji: syntax | Low | Unique constraint |
| View all custom emoji | Discovery | Low | Tab in emoji picker |
| Delete own emoji | User control | Low | Permission check |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated GIF emoji | Fun, expressive | Low | Already support GIF format |
| Emoji aliases | Multiple names for same emoji | Low | Additional name mapping |
| Bulk upload | Migration from Slack | Medium | Import tool |
| Emoji usage stats | See popular emoji | Low | Count usage |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Emoji size larger than standard | Breaks message layout | Standardize to 128x128 or similar |
| Custom emoji in usernames | Display issues, abuse potential | Only in messages/reactions |
| Per-channel emoji | Fragmentation | Workspace-wide only |

**Recommendation:** Upload flow with image validation (square, max 128KB, 128x128 recommended). Admin permission control for who can upload.

**Technical Requirements:**
- Image formats: JPG, PNG, GIF (including animated)
- Max size: 128KB (Slack standard)
- Recommended dimensions: 128x128 pixels
- Store original + generate resized versions
- Emoji names: alphanumeric + underscores, 2-32 chars

**Sources:**
- [Slack: Add custom emoji and aliases](https://slack.com/help/articles/206870177-Add-custom-emoji-and-aliases-to-your-workspace)
- [Mattermost: Custom Emojis](https://docs.mattermost.com/end-user-guide/collaborate/react-with-emojis-gifs.html)

---

## Feature 10: Channel Archiving

**Slack Reference:** Archive puts channel in read-only state, preserving history but removing from active view.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Archive channel (read-only) | Core feature | Low | Boolean flag on channel |
| Preserved in search | History remains accessible | Low | Don't exclude from search |
| Removed from sidebar | Declutter active view | Low | Filter in channel list |
| Browse archived channels | Find old channels | Low | Separate list/section |
| Unarchive channel | Reversible action | Low | Clear flag |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-archive inactive channels | Reduce clutter automatically | Medium | Scheduled job, configurable threshold |
| Archive with reason | Documentation | Low | Optional text field |
| Preserve member list on unarchive (private) | Slack behavior | Low | Don't clear memberships |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Delete channel | Irreversible data loss | Always archive instead |
| Archive #general | Core channel must stay active | Prevent archiving default channel |
| Hide archived content from search | Breaks knowledge discovery | Keep searchable |

**Recommendation:** Simple archive flag with read-only enforcement. Prevent message sending but allow viewing and searching.

**Permission Consideration:** Slack allows any member to archive by default. Consider restricting to channel creators or admins.

**Sources:**
- [Slack: Archive or delete a channel](https://slack.com/help/articles/213185307-Archive-or-delete-a-channel)

---

## Feature 11: Guest Accounts

**Slack Reference:** Single-Channel Guests (free, one channel) and Multi-Channel Guests (paid, multiple channels).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Invite external user as guest | Core functionality | Medium | New role type in members |
| Restrict to specific channels | Guest limitation | Medium | Channel-level membership only |
| Visual indicator (guest badge) | Transparency | Low | UI marker on guest profiles |
| Guest can message, react, upload | Basic participation | Low | Same as members in allowed channels |
| Remove guest access | Offboarding | Low | Deactivate or remove |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Time-limited guest access | Auto-expire after project ends | Medium | Scheduled deactivation |
| Guest invitation by members | Reduce admin burden | Low | Permission setting |
| Single-channel vs multi-channel types | Slack's model | Medium | Different permission sets |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Guests in user groups | Slack explicitly prevents this | Groups are internal only |
| Guest access to member directory | Privacy concern | Only see channel members |
| Guest-to-guest DMs (cross-channel) | Unintended communication paths | DMs only with channel co-members |
| Unlimited guest invites | Potential abuse | Rate limit or admin approval |

**Recommendation:** Start with simple guest role: can access specified channels, no directory access, clear visual distinction. Skip single vs multi-channel complexity initially.

**Self-Hosted Value:** For data sovereignty, guests are managed entirely within your infrastructure - no external service like Slack Connect.

**Sources:**
- [Slack: Understand guest roles](https://slack.com/help/articles/202518103-Understand-guest-roles-in-Slack)
- [Slack: Managing guest access at scale](https://slack.com/blog/collaboration/managing-slack-at-scale-how-to-streamline-guest-access)

---

## Feature 12: Workspace Analytics

**Slack Reference:** Admin dashboard showing activity metrics by member, channel, and feature usage.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Message volume over time | Basic activity metric | Low | Aggregate from messages table |
| Active users (DAU/WAU/MAU) | Standard engagement metric | Low | Count distinct users |
| Channel activity ranking | See busy vs quiet channels | Low | Messages per channel |
| Date range filtering | View different time periods | Low | Query parameters |
| Export to CSV | Reporting needs | Low | Format existing data |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Feature adoption metrics | See what's being used | Medium | Track feature-specific events |
| Peak usage times | Capacity planning | Low | Hourly aggregation |
| Growth trends | Trajectory visibility | Low | Compare periods |
| File storage usage | Resource planning | Low | Sum file sizes |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-user message counts (visible to all) | Surveillance, anxiety-inducing | Admin-only or aggregate only |
| Detailed time tracking | Not a productivity surveillance tool | Stick to engagement metrics |
| Real-time individual monitoring | Privacy violation | Aggregate, delayed data only |
| Ranking/leaderboards | Gamification backfire | Neutral presentation |

**Recommendation:** Focus on aggregate workspace health metrics. Admin-only access by default. Avoid individual user surveillance.

**Privacy-Conscious Approach:**
- Show channel-level stats, not individual user activity
- Allow admins to disable member-level analytics entirely
- Make analytics opt-in for self-hosted deployments
- Focus on "is the platform being used?" not "who's slacking?"

**Sources:**
- [Slack: View your analytics dashboard](https://slack.com/help/articles/218407447-View-your-Slack-analytics-dashboard)
- [Slack: Understand analytics data](https://slack.com/help/articles/360057638533-Understand-the-data-in-your-Slack-analytics-dashboard)

---

## Feature Dependencies

```
Independent features (can implement in any order):
- User Status Messages
- Bookmarks / Saved Messages
- Channel Categories
- Channel Archiving
- Custom Emoji

Depends on scheduled job infrastructure:
- Scheduled Messages (delivery worker)
- Reminders (notification worker)
- Guest Accounts (expiration worker, if time-limited access)

Depends on WebSocket/Socket.IO:
- Typing Indicators (already have real-time infrastructure)

Requires external HTTP requests:
- Link Previews / Unfurling (fetch external URLs)

Depends on user groups:
- User Groups must exist before @group mentions work

Analytics depends on data:
- Workspace Analytics (needs data to analyze, can implement anytime)
```

---

## MVP Recommendation

For v0.5.0, prioritize in this order based on user value and complexity:

### High Priority (Core UX improvements)

1. **User Status Messages** - Low complexity, high visibility, universal expectation
2. **Typing Indicators** - Low-medium complexity, makes platform feel "alive"
3. **Channel Categories** - Medium complexity, essential for larger workspaces
4. **Bookmarks / Saved Messages** - Low complexity, personal productivity

### Medium Priority (Power features)

5. **Channel Archiving** - Low complexity, workspace hygiene
6. **Custom Emoji** - Medium complexity, culture/fun, high engagement
7. **User Groups** - Medium complexity, scales mentions for teams
8. **Link Previews** - Medium complexity, message richness

### Lower Priority (Can defer)

9. **Scheduled Messages** - Medium complexity, lower daily usage
10. **Reminders** - Medium complexity, overlaps with scheduled messages
11. **Guest Accounts** - Medium complexity, enterprise feature
12. **Workspace Analytics** - Low complexity but low urgency

---

## Complexity Estimates

| Feature | Backend | Frontend | Total | Notes |
|---------|---------|----------|-------|-------|
| User Status Messages | Low | Low | Low | DB column + API + UI |
| Bookmarks / Saved Messages | Low | Low | Low | Junction table + UI |
| Scheduled Messages | Medium | Low | Medium | Scheduler infrastructure |
| Reminders | Medium | Medium | Medium | Similar to scheduled + UI |
| User Groups | Medium | Medium | Medium | New entity + mention integration |
| Channel Categories | Low | Medium | Medium | Mostly frontend drag-drop |
| Link Previews | High | Medium | High | External fetching, caching |
| Typing Indicators | Low | Low | Low | WebSocket events |
| Custom Emoji | Medium | Medium | Medium | File handling + picker integration |
| Channel Archiving | Low | Low | Low | Flag + filter |
| Guest Accounts | Medium | Medium | Medium | New role + access control |
| Workspace Analytics | Medium | Medium | Medium | Aggregation queries + dashboard |

---

## Sources Summary

### Primary Sources (HIGH Confidence)
- [Slack Help Center](https://slack.com/help) - Official feature documentation
- [Slack Developer Docs](https://docs.slack.dev) - API and implementation details
- [Discord Support](https://support.discord.com) - Discord feature documentation
- [Microsoft Learn - Teams](https://learn.microsoft.com/en-us/microsoftteams/) - Teams documentation
- [Mattermost Docs](https://docs.mattermost.com) - Self-hosted alternative reference

### Implementation References (MEDIUM Confidence)
- [OpenGraph.io Guide](https://www.opengraph.io/unfurl-url) - Link unfurling best practices
- [Medium: Typing Indicator Architecture](https://medium.com/@ramesh200212/building-a-scalable-real-time-typing-indicator-system-a-deep-dive-into-distributed-architecture-5f14b331c4ab) - Scaling considerations

---

*Researched: 2026-01-20 for OComms v0.5.0 Feature Completeness milestone*
