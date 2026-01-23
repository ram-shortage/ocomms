# OComms

A self-hosted team communication platform. Think Slack, but you own your data.

## Why OComms?

Organizations increasingly need real-time communication tools, but cloud-hosted solutions come with trade-offs: data leaves your control, per-seat pricing scales expensively, and you're dependent on vendor decisions. OComms gives you a full-featured team chat platform that runs entirely on your infrastructure.

**Data Sovereignty** — Your messages, files, and user data never leave servers you control. No third-party analytics, no data mining, no external API dependencies for core features.

**Self-Hosted** — Deploy with a single `docker compose up` command. Runs on any infrastructure: cloud VMs, on-premise servers, or even a Raspberry Pi for small teams.

**No Per-Seat Pricing** — One deployment supports your entire organization. Scale to hundreds of concurrent users without scaling costs.

## Features

### Real-Time Messaging
- Instant message delivery via WebSockets
- Channels (public and private) with membership management
- Direct messages (1:1 and group conversations)
- Message threading with dedicated thread panel
- Emoji reactions with custom emoji support
- Typing indicators ("[Name] is typing...")

### Organization & Discovery
- Workspaces with tenant isolation
- Workspace switcher with unread counts
- Browse and join available workspaces
- Join request approval workflow
- Channel categories with collapsible sidebar sections
- Drag-and-drop sidebar reordering (categories, channels, DMs, sections)
- Channel archiving (read-only mode)
- Full-text search across all accessible messages
- Member profiles with avatars

### Attention Management
- @user, @channel, @here, and @group mentions
- User groups for team mentions (@designers, @engineering)
- Real-time notifications with customizable settings
- Per-channel mute and mention-only modes
- Unread counts and mark-as-read
- Reminders on messages (snooze, recurring)
- Bookmarks for saved messages and files

### Scheduling & Productivity
- Scheduled messages with timezone support
- Custom user status (emoji, text, DND mode)
- Status expiration (auto-clear after duration)

### Rich Content
- Link previews with Open Graph unfurling
- Custom emoji upload (PNG, JPG, GIF, SVG)
- File uploads up to 25MB (drag-drop, clipboard paste)
- Image inline previews and download cards
- Channel notes (shared markdown per channel)
- Personal notes (private scratchpad)

### Presence
- Online/away/offline status indicators
- Real-time presence updates across all clients
- Do Not Disturb mode

### Mobile & Offline
- Progressive Web App (PWA) with install prompt
- Offline message reading (7-day cache)
- Offline send queue with automatic sync
- Push notifications (Web Push API)
- Responsive mobile layout with bottom navigation
- Mobile More menu for Scheduled/Reminders/Saved access
- Mobile-optimized emoji picker
- Mobile touch targets (minimum 44px)

### Access Control
- Guest accounts with channel-scoped access
- Guest expiration dates (auto-deactivate)
- Guest badge on profiles and messages

### Administration
- Workspace analytics dashboard
- Message volume, DAU/WAU/MAU metrics
- Channel activity and storage usage
- CSV export for analytics data
- GDPR-compliant data export
- Audit logs with filtering

### Security
- CSP nonce-based script loading
- Server-side session validation with immediate revocation
- SVG upload blocking with content detection
- Socket.IO rate limiting
- TOTP MFA with backup codes
- Password breach detection
- Per-user storage quotas
- HMAC-signed audit logs
- SSRF protection for link previews
- Subresource Integrity for static assets

### Self-Hosted Ready
- Single-command Docker deployment
- PostgreSQL backup and restore scripts
- No external service dependencies
- BullMQ job queues for background tasks

## Tech Stack

- **Frontend:** Next.js 15, React, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Socket.IO, Drizzle ORM
- **Database:** PostgreSQL with native full-text search
- **Real-Time:** Socket.IO with Redis pub/sub for horizontal scaling
- **Job Queue:** BullMQ with Redis for scheduled tasks
- **Deployment:** Docker Compose with nginx reverse proxy

## Quickstart

For experienced users familiar with Docker and web application deployment:

```bash
# 1. Clone and configure
git clone https://github.com/ram-shortage/ocomms.git
cd ocomms
cp .env.example .env

# 2. Generate secrets
openssl rand -base64 32  # Use for BETTER_AUTH_SECRET and AUTH_SECRET
npx web-push generate-vapid-keys  # For push notifications

# 3. Edit .env with your values
# Required: DATABASE_URL, DB_PASSWORD, BETTER_AUTH_SECRET, AUTH_SECRET
# Required: APP_URL, NEXT_PUBLIC_APP_URL, CERTBOT_EMAIL
# Optional: SMTP_*, VAPID_*, REDIS_URL

# 4. Deploy with Docker Compose
docker compose up -d

# 5. Run database migrations
docker compose exec app npm run db:migrate

# 6. Access at https://your-domain.com
```

**Minimum Requirements:**
- Server: 2GB RAM, 2 CPU cores, 20GB disk
- Docker Engine 24+ with Compose v2
- Domain name with DNS A record pointing to server
- Ports 80 and 443 open

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Development

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis (dev containers)
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:push

# Start development server
npm run dev

# Start worker process (separate terminal)
npm run worker
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BETTER_AUTH_SECRET` | Secret for session encryption | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL of your deployment | Yes |
| `REDIS_URL` | Redis connection for scaling | Yes |
| `SMTP_HOST` | SMTP server for emails | No |
| `SMTP_PORT` | SMTP port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |
| `VAPID_PUBLIC_KEY` | Web Push public key | No |
| `VAPID_PRIVATE_KEY` | Web Push private key | No |

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete configuration reference.

### Backup & Restore

```bash
# Create backup
docker compose exec db pg_dump -U postgres ocomms > ./backups/ocomms-$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T db psql -U postgres -d ocomms < ./backups/ocomms-20240115.sql
```

### Data Export

For GDPR compliance or data portability:

```bash
# CLI export
npx tsx scripts/export-data.ts <organization-id> ./export

# Or via Admin UI at /settings/admin
```

## Testing

OComms maintains comprehensive test coverage:

```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage
```

**Test Suite:** 885+ tests covering:
- Socket.IO message, thread, and notification handlers
- API route authentication and authorization
- Server actions and business logic
- Data integrity and concurrency
- Guest account restrictions
- UI components with React Testing Library

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   nginx     │────▶│   Next.js   │────▶│ PostgreSQL  │
│   :80/443   │     │   + Socket  │     │   :5432     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
             ┌─────────────┐ ┌─────────────┐
             │    Redis    │ │   Worker    │
             │   :6379     │ │  (BullMQ)   │
             └─────────────┘ └─────────────┘
```

- **nginx** — Reverse proxy with WebSocket upgrade support and Let's Encrypt SSL
- **Next.js + Socket.IO** — Application server handling HTTP and WebSocket connections
- **PostgreSQL** — Primary database with full-text search
- **Redis** — Pub/sub for real-time messaging and job queue persistence
- **Worker** — Background job processor for scheduled messages, reminders, link previews

## Roadmap

**Current Version: v0.6.0** — Polish & Hardening

Completed milestones:
- **v0.1.0** — Full conversation features (channels, DMs, threads, search)
- **v0.2.0** — Security hardening (HTTPS, rate limiting, audit logging)
- **v0.3.0** — Mobile experience (PWA, offline, push notifications)
- **v0.4.0** — Files, theming & notes (dark mode, uploads, markdown notes)
- **v0.5.0** — Feature completeness (scheduling, reminders, bookmarks, status, link previews, custom emoji, user groups, guests, analytics)
- **v0.6.0** — Polish & hardening (security hardening, workspace management, sidebar reorg, mobile redesign)

Future versions may include:
- [ ] Message editing
- [ ] Rich text formatting
- [ ] SSO/SAML integration
- [ ] Webhooks and bot accounts
- [ ] Slash command framework

See [.planning/PROJECT.md](.planning/PROJECT.md) for detailed planning documents.

## Release History

| Version | Date | Highlights |
|---------|------|------------|
| v0.6.0 | 2026-01-23 | Security hardening (22 fixes), workspace switcher, sidebar drag-drop, mobile redesign |
| v0.5.0 | 2026-01-21 | Scheduling, reminders, bookmarks, status, link previews, custom emoji, user groups, guests, analytics |
| v0.4.0 | 2026-01-20 | Dark mode, file uploads, channel notes, personal notes |
| v0.3.0 | 2026-01-19 | PWA, offline support, push notifications, mobile layout |
| v0.2.0 | 2026-01-18 | HTTPS, security headers, rate limiting, audit logging |
| v0.1.0 | 2026-01-18 | Real-time messaging, channels, DMs, threads, search |

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Contributing

Contributions are welcome! Please read the codebase documentation in `.planning/` to understand the architecture and conventions.

## License

[MIT](LICENSE)

---

Built with the belief that team communication tools shouldn't require giving up control of your data.
