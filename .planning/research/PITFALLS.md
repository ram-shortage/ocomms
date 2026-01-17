# Domain Pitfalls

**Project:** OComms - Self-Hosted Team Chat Platform
**Researched:** 2026-01-17
**Confidence:** MEDIUM-HIGH (cross-verified with multiple sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture problems.

---

### Pitfall 1: WebSocket State Management Without Pub/Sub

**What goes wrong:** Building WebSocket handling where each server instance manages its own connections without inter-server communication. When User A on Server 1 sends a message to User B on Server 2, the message never arrives.

**Why it happens:** Developers start with a single-server architecture that works perfectly in development. The WebSocket server handles connections and routing together. When scaling to multiple instances behind a load balancer, the architecture silently breaks.

**Consequences:**
- Messages delivered to some users but not others
- Presence shows users as offline when they're online on a different server
- Typing indicators never reach recipients
- Complete rewrite of real-time layer required

**Warning signs:**
- No Redis/message broker in architecture diagrams
- WebSocket server stores connection state in memory
- Load balancer configured for sticky sessions as a "fix"
- Works in dev, breaks in production with multiple instances

**Prevention:**
1. Design for pub/sub from day one - every WebSocket server subscribes to relevant channels
2. Externalize connection state to Redis or similar
3. Test with 2+ server instances from the start, even in development
4. Never use sticky sessions as a scaling strategy

**Phase to address:** Phase 1 (Foundation) - Must be in the core architecture

**Sources:**
- [Ably WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
- [Scaling WebSockets Over Distributed Systems](https://medium.com/@taycode/websockets-scaling-over-a-distributed-system-ea567d8372e5)

---

### Pitfall 2: Message Ordering Chaos at Scale

**What goes wrong:** Messages appear out of order in conversations, especially in active channels. User sees "Thanks!" before the question it responds to.

**Why it happens:** Relying on client timestamps or processing order instead of server-assigned sequence numbers. Multiple parallel processes handle messages at different speeds. Clock drift between devices compounds the problem.

**Consequences:**
- Conversations become unintelligible
- Reply threading breaks
- Users lose trust in the platform
- Extremely difficult to fix retroactively without data migration

**Warning signs:**
- Using client-side timestamps as the ordering mechanism
- No server sequence number per conversation/thread
- Async message processing without ordering guarantees
- "It usually works" attitude in testing

**Prevention:**
1. Assign server sequence numbers per conversation when message is stored
2. Server order is the tie-breaker, not client timestamps
3. Client timestamps are for display only (show "sent at X")
4. Use database transactions to ensure atomic sequence assignment

**Phase to address:** Phase 1 (Messages) - Core data model decision

**Sources:**
- [Designing Chat Architecture for Reliable Message Ordering](https://ably.com/blog/chat-architecture-reliable-message-ordering)
- [System Design Handbook: Design a Chat System](https://www.systemdesignhandbook.com/guides/design-a-chat-system/)

---

### Pitfall 3: Thread Model Complexity Explosion

**What goes wrong:** Thread implementation becomes unmaintainable. Queries for "show this thread" become N+1 nightmares. Moving a message to a thread corrupts ordering. Deep nesting creates UI chaos.

**Why it happens:** Treating threads as a simple "parent_id" relationship without considering query patterns, ordering, and depth limits. Copying Slack's model without understanding the underlying complexity.

**Consequences:**
- Performance degrades with thread depth
- Recursive queries kill database
- Thread updates cause cascade of recomputations
- Mobile clients struggle with deep threads

**Warning signs:**
- Recursive CTEs in production queries
- No depth limit on thread nesting
- Thread membership computed on every fetch
- "We'll optimize later" for thread queries

**Prevention:**
1. Use materialized path (`path` column) for thread hierarchy - O(1) queries
2. Limit thread depth (Slack uses 1 level: message -> replies, no nested replies)
3. Store thread metadata (reply_count, last_reply_at) denormalized on parent
4. Order by path gives render order in single query

**Phase to address:** Phase 1 (Messages + Threads) - Data model decision

**Sources:**
- [GitHub Discussion: Modeling Threaded Comments](https://github.com/orgs/community/discussions/167352)
- [Stream Chat: Threads & Replies](https://getstream.io/chat/docs/react/threads/)

---

### Pitfall 4: Unread Counts That Lie

**What goes wrong:** Unread badge shows "5" but user sees no unread messages. Or shows nothing when there are new messages. Multi-device users see different unread states.

**Why it happens:** Unread state stored per-device instead of per-user. Read receipts not synced across devices. Race conditions between "mark as read" and "new message arrives." Eventual consistency treated as "good enough."

**Consequences:**
- Users don't trust the notification system
- Important messages missed
- Users develop workarounds (always open every channel)
- Phantom notifications drive users crazy

**Warning signs:**
- Unread count computed client-side
- No "read horizon" concept (timestamp of last read message)
- Read receipts not persisted server-side
- "Mark all as read" doesn't sync across devices

**Prevention:**
1. Store read horizon (last_read_message_id or last_read_at) per user per channel, server-side
2. Unread count = messages after read horizon
3. Every device syncs read horizon on connect
4. Mark-as-read is an atomic server operation, not client state
5. Handle race: if marking read while new message arrives, keep the newer unread

**Phase to address:** Phase 2 (Unreads/Mentions) - After basic messaging works

**Sources:**
- [Twilio: Read Horizon and Read Status](https://www.twilio.com/docs/conversations/read-horizon)
- [Stream Chat: Unread Counts](https://getstream.io/chat/docs/react/unread/)

---

### Pitfall 5: Self-Hosted Deployment Data Loss

**What goes wrong:** Users deploy with Docker, restart container, lose all messages and configuration. Or upgrade version and corrupt database.

**Why it happens:** Not enforcing volume mounts for persistent data. SQLite as default database. No migration safety checks. Documentation assumes technical users who "know" to mount volumes.

**Consequences:**
- Complete data loss on container restart
- Users blame the product, not their deployment
- Support burden from preventable issues
- Reputation damage in self-hosted community

**Warning signs:**
- Docker Compose without named volumes
- SQLite as only/default database option
- No pre-flight checks in startup script
- Upgrade docs say "just pull new image"

**Prevention:**
1. Fail startup if persistent storage not configured (check for marker file)
2. Use PostgreSQL, not SQLite, for production (SQLite for dev only)
3. Docker Compose templates with explicit named volumes
4. Startup script checks: volume mounted, migrations safe, backup reminder
5. Version-specific migration guides, not "just upgrade"

**Phase to address:** Phase 1 (Deployment) - Before any public release

**Sources:**
- [Self-Hosting Beginner Mistakes](https://www.xda-developers.com/self-hosting-beginner-mistakes/)
- [Sliplane: Docker Deployment Mistakes](https://sliplane.io/blog/5-costly-mistakes-when-deploying-docker-containers)

---

## Moderate Pitfalls

Mistakes that cause significant delays, technical debt, or poor user experience.

---

### Pitfall 6: Presence System That Doesn't Scale

**What goes wrong:** Presence updates (online/away/offline) flood the system. With 500 users, thousands of presence events per second. Server overwhelmed, clients laggy.

**Why it happens:** Broadcasting every presence change to every user. No batching, throttling, or smart subscription. Treating presence like messages (must be instant and guaranteed).

**Consequences:**
- System becomes sluggish under load
- Presence appears "laggy" or "bouncy"
- Battery drain on mobile clients
- Server costs explode

**Warning signs:**
- Presence sent to all workspace members on every change
- No distinction between "user went offline" and "user lost connection briefly"
- No throttling on presence events
- Testing only with <10 users

**Prevention:**
1. Presence is eventually consistent, not instant - batch updates
2. Only send presence to users who have the presencer's channel/DM open
3. Debounce connection drops (wait 30s before "offline")
4. Client polls presence periodically, server pushes only for open conversations
5. Tiered approach: instant for DMs, batched for channels

**Phase to address:** Phase 2 (Presence/Status) - Design carefully before implementing

**Sources:**
- [AWS Chime SDK: Presence and Typing Indicators](https://aws.amazon.com/blogs/business-productivity/build-presence-and-typing-indicators-with-amazon-chime-sdk-messaging/)
- [Ably Chat: Typing Indicators](https://ably.com/docs/chat/rooms/typing)

---

### Pitfall 7: Search That Doesn't Search

**What goes wrong:** Search is slow (seconds to return results). Recent messages not findable. Typos return nothing. Users stop using search.

**Why it happens:** Using LIKE queries on PostgreSQL without full-text search. Elasticsearch added later but sync is eventually consistent with multi-second lag. No typo tolerance or relevance ranking.

**Consequences:**
- Core feature unusable
- Users scroll manually instead of searching
- Migration to proper search is painful
- Competitor advantage

**Warning signs:**
- `WHERE content LIKE '%search%'` in codebase
- No search infrastructure in architecture
- "We'll add Elasticsearch later"
- Search tested with 100 messages, not 1 million

**Prevention:**
1. Use PostgreSQL full-text search for MVP (tsvector/tsquery) - good enough to start
2. For scale: pg_search extension provides Elasticsearch-quality search inside Postgres
3. If using Elasticsearch: index synchronously or near-synchronously (not batch)
4. Include message ID, channel, sender in index for filtering
5. Consider ParadeDB/pg_search for transactional consistency

**Phase to address:** Phase 3 (Search) - But plan data model in Phase 1

**Sources:**
- [ParadeDB: pg_search](https://www.paradedb.com/blog/introducing_search)
- [Neon: PostgreSQL Full-Text Search vs Elasticsearch](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch)
- [Stream Chat + Elasticsearch Integration](https://getstream.io/blog/chat-elasticsearch/)

---

### Pitfall 8: Multi-Device Notification Chaos

**What goes wrong:** User reads message on desktop, phone buzzes 10 seconds later. Or user is on phone, desktop shows notification. Users get duplicates or miss messages entirely.

**Why it happens:** No coordination between devices. Each device tracks its own notification state. Push notifications fire independently of WebSocket connections.

**Consequences:**
- Users disable notifications (then miss messages)
- Notification fatigue
- Unprofessional experience compared to Slack
- Support tickets about "broken" notifications

**Warning signs:**
- Push notifications sent regardless of active WebSocket connection
- No "suppress if active on other device" logic
- Notification read state per-device, not per-user
- "Smart notifications" treated as nice-to-have

**Prevention:**
1. Track active devices per user (which have WebSocket connection)
2. Delay push notification if user active on any device (10-30 second grace period)
3. If user reads on Device A, cancel pending push to Device B
4. Clear notification badges across devices when message read
5. Let users configure: "notify mobile only if inactive for X minutes"

**Phase to address:** Phase 3 (Notifications) - Requires presence/activity tracking from Phase 2

**Sources:**
- [ClickUp Feedback: Smart Notifications](https://feedback.clickup.com/chat-feedback/p/dont-send-mobile-notifications-if-active-on-web-desktop-app)
- [Rocket.Chat Push Notifications](https://docs.rocket.chat/docs/push)

---

### Pitfall 9: Authentication Without Escape Hatches

**What goes wrong:** SSO configured, IDP goes down, all users locked out. Or password reset email never arrives, user can't access workspace.

**Why it happens:** Single authentication path with no fallback. SSO misconfiguration locks out admins. Email provider issues block password resets.

**Consequences:**
- Complete workspace lockout
- Emergency support escalations
- Data hostage situations
- Trust destruction

**Warning signs:**
- No admin bypass mechanism
- SSO as the only authentication option
- No local admin account for emergencies
- Password reset depends on single email provider

**Prevention:**
1. Always maintain emergency local admin account
2. SSO failure should allow fallback to local auth (configurable)
3. Multiple password reset mechanisms (email, admin reset, backup codes)
4. Test SSO failure scenarios before production
5. Document "locked out" recovery procedure prominently

**Phase to address:** Phase 1 (Auth) - Build escape hatches from start

**Sources:**
- [Langfuse: Authentication and SSO](https://langfuse.com/self-hosting/authentication-and-sso)
- [Rocket.Chat SSO Login Problems](https://forums.rocket.chat/t/ios-and-android-apps-sso-login-problem/6483)

---

### Pitfall 10: Mobile Push Notification Limits

**What goes wrong:** Self-hosted users don't receive mobile push notifications, or hit free-tier limits quickly.

**Why it happens:** Push notifications require gateway services (Firebase, APNs) which need API keys and often have usage limits. Self-hosted deployments can't easily use the vendor's push infrastructure.

**Consequences:**
- Mobile experience significantly degraded
- Users miss time-sensitive messages
- "Works on web, broken on mobile" perception
- Rocket.Chat's 5000/month limit hit quickly even with few users

**Warning signs:**
- No push notification gateway in self-hosted architecture
- Relying on third-party free tier without limits awareness
- Push not tested in self-hosted deployment scenario
- Mobile app depends on vendor's push gateway

**Prevention:**
1. Document push notification setup clearly for self-hosted
2. Provide or integrate with self-hosted push gateway (like ntfy, Gotify)
3. Allow users to bring their own Firebase/APNs credentials
4. Clearly communicate limits and costs
5. Web push as fallback when mobile push unavailable

**Phase to address:** Phase 3 (Mobile/Notifications) - Plan in architecture from start

**Sources:**
- [Rocket.Chat Push Issues](https://forums.rocket.chat/t/ios-and-android-apps-sso-login-problem/6483)
- [Rocket.Chat Push Documentation](https://docs.rocket.chat/docs/push)

---

## Minor Pitfalls

Mistakes that cause annoyance, rework, or suboptimal UX but are fixable.

---

### Pitfall 11: Typing Indicators That Stick

**What goes wrong:** "User is typing..." shows forever after user abandoned the message. Or typing indicator bounces on/off rapidly with each keystroke.

**Why it happens:** No timeout on typing state. No debouncing on keystroke events. Network issues prevent "stopped typing" from reaching server.

**Consequences:**
- Users wait for messages that never come
- Annoying UI flicker
- Cross-platform inconsistencies
- Minor but noticeable polish issue

**Prevention:**
1. Typing indicator auto-expires after 3-5 seconds without keystroke
2. Debounce typing events (send max every 2 seconds)
3. "Stop typing" sent explicitly on blur/send
4. Client-side timeout if no refresh from server
5. Don't persist typing state - ephemeral only

**Phase to address:** Phase 2 (Real-time features) - Easy to get right with planning

**Sources:**
- [PubNub: Typing Indicator](https://www.pubnub.com/docs/chat/chat-sdk/build/features/channels/typing-indicator)
- [How-To Geek: Typing Indicators](https://www.howtogeek.com/that-typing-indicator-you-see-its-lying-to-you-sometimes/)

---

### Pitfall 12: Emoji Reactions That Duplicate

**What goes wrong:** User clicks reaction, nothing happens, clicks again, two reactions appear. Or reaction shows on one device but not another.

**Why it happens:** Optimistic UI without proper deduplication. Race condition between "add reaction" events. Reaction state not properly synced across devices.

**Consequences:**
- Confusing reaction counts
- Users wonder if their reaction registered
- Data inconsistency across devices
- Minor trust erosion

**Prevention:**
1. Reactions are unique per (message, user, emoji) - database constraint
2. Toggle semantics: if exists, remove; if not, add
3. Optimistic UI with rollback on conflict
4. Return current reaction state after mutation (not just success/fail)
5. Include reaction sync in message fetch, not separate call

**Phase to address:** Phase 2 (Reactions) - Plan data model carefully

---

### Pitfall 13: Pin/Bookmark Limits Not Enforced

**What goes wrong:** Users pin hundreds of messages, making pins useless. Or workspace runs out of storage because pinned attachments are never cleaned up.

**Why it happens:** No limits on pins per channel. Pinned items not subject to message retention. No UI to manage large pin lists.

**Consequences:**
- Pins become unusable (too many to browse)
- Storage costs for pinned attachments
- Users complain about useless feature
- Difficult to retrofit limits without data migration

**Prevention:**
1. Limit pins per channel (Slack: 100 per channel)
2. Show "pin limit reached" rather than silently failing
3. Provide pin management UI (bulk unpin, sort by date)
4. Consider: pins subject to retention, or pins preserve messages
5. Document limits clearly

**Phase to address:** Phase 2 (Pins) - Define limits in requirements

---

### Pitfall 14: Channel/DM Naming Collisions

**What goes wrong:** User creates channel "engineering", another workspace also has "engineering", URL routing breaks. Or DM with deleted user has orphaned data.

**Why it happens:** Channel slugs not scoped to workspace. DM lookup assumes both users exist. URL patterns collide between channels and reserved paths.

**Consequences:**
- Routing bugs
- 404s for valid channels
- Orphaned data from deleted users
- URL structure rework later

**Prevention:**
1. Channel slugs scoped: `workspace_id + slug` unique constraint
2. Reserve URL paths: `/settings`, `/admin`, `/search` can't be channel names
3. DM identified by sorted user pair, handle deleted users gracefully
4. Validate channel names against reserved list on create/rename

**Phase to address:** Phase 1 (Channels/DMs) - URL design decision

---

### Pitfall 15: Attachment Storage Assumptions

**What goes wrong:** Self-hosted users run out of disk space. Or S3 credentials expire and all attachments become 404. Or attachment URLs exposed publicly.

**Why it happens:** Assuming unlimited storage. Single storage backend without abstraction. Signed URLs not implemented. No attachment cleanup policy.

**Consequences:**
- Disk space exhaustion crashes deployment
- Broken attachments destroy message history
- Security exposure if attachments public
- Difficult to migrate storage backends

**Prevention:**
1. Abstract storage backend (local, S3, GCS compatible)
2. Signed URLs with expiration for attachments
3. Quota enforcement per workspace
4. Document storage requirements clearly
5. Attachment retention policy aligned with message retention

**Phase to address:** Phase 2 (File uploads) - Storage abstraction from start

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|------------|----------------|------------|
| Foundation/Architecture | WebSocket scaling (Pitfall 1) | Pub/sub from day one, test with multiple instances |
| Messages | Ordering (Pitfall 2), Threads (Pitfall 3) | Server sequence numbers, materialized path |
| Channels/DMs | Naming collisions (Pitfall 14) | Scoped slugs, reserved words |
| Real-time | Presence overload (Pitfall 6), Typing stickiness (Pitfall 11) | Batch presence, timeout typing |
| Unreads/Mentions | Lying badges (Pitfall 4) | Server-side read horizon |
| Search | Slow/missing results (Pitfall 7) | PostgreSQL FTS or pg_search |
| Authentication | Lockout scenarios (Pitfall 9) | Emergency admin bypass |
| Notifications | Multi-device chaos (Pitfall 8), Push limits (Pitfall 10) | Active device tracking, self-hosted push gateway |
| Deployment | Data loss (Pitfall 5) | Volume mount checks, startup validation |

---

## Self-Hosted Specific Pitfalls Summary

These pitfalls are specific to or amplified by the self-hosted deployment model:

1. **Data persistence** (Pitfall 5) - Docker users losing data on restart
2. **Push notification infrastructure** (Pitfall 10) - No access to vendor push gateways
3. **SSO lockout** (Pitfall 9) - Admin can't recover if IDP misconfigured
4. **Storage limits** (Pitfall 15) - Self-hosters may have limited disk space
5. **Hardware requirements** - Under-specced servers cause cascading failures
6. **Database choice** - SQLite works in demo, fails at scale
7. **Network configuration** - Firewalls, reverse proxies, WebSocket upgrades

**Prevention pattern for all:**
- Fail loudly with helpful errors, not silently
- Document requirements clearly with examples
- Provide health checks and diagnostics
- Make common configurations easy, advanced configurations possible

---

## Sources Summary

### WebSocket and Real-time
- [Ably: WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
- [Ably: Scaling WebSockets](https://ably.com/topic/the-challenge-of-scaling-websockets)
- [Ably: Message Ordering at Scale](https://ably.com/blog/chat-architecture-reliable-message-ordering)
- [InfiniteJS: WebSocket Mistakes in Node.js](https://infinitejs.com/posts/avoiding-websocket-mistakes-nodejs-chat/)

### Self-Hosted Deployment
- [XDA: Self-Hosting Beginner Mistakes](https://www.xda-developers.com/self-hosting-beginner-mistakes/)
- [Sliplane: Docker Deployment Mistakes](https://sliplane.io/blog/5-costly-mistakes-when-deploying-docker-containers)
- [Mattermost vs Rocket.Chat Comparison](https://www.blackvoid.club/rocket-chat-vs-mattermost/)

### Chat Architecture
- [Ably: Scalable Chat App Architecture](https://ably.com/blog/chat-app-architecture)
- [RST Software: Chat App Architecture Guide](https://www.rst.software/blog/chat-app-architecture)
- [System Design Handbook: Chat System](https://www.systemdesignhandbook.com/guides/design-a-chat-system/)

### Search
- [ParadeDB: pg_search](https://www.paradedb.com/blog/introducing_search)
- [Neon: PostgreSQL vs Elasticsearch](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch)
- [Stream Chat + Elasticsearch](https://getstream.io/blog/chat-elasticsearch/)

### Notifications and Sync
- [Twilio: Read Horizon](https://www.twilio.com/docs/conversations/read-horizon)
- [Stream Chat: Unread Counts](https://getstream.io/chat/docs/react/unread/)
- [AWS Chime: Presence and Typing](https://aws.amazon.com/blogs/business-productivity/build-presence-and-typing-indicators-with-amazon-chime-sdk-messaging/)
