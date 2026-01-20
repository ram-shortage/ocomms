# OComms

A self-hosted team communication platform. Think Slack, but you own your data.

## Why OComms?

Organizations increasingly need real-time communication tools, but cloud-hosted solutions come with trade-offs: data leaves your control, per-seat pricing scales expensively, and you're dependent on vendor decisions. OComms gives you a full-featured team chat platform that runs entirely on your infrastructure.

**Data Sovereignty** — Your messages, files, and user data never leave servers you control. No third-party analytics, no data mining, no external API dependencies for core features.

**Self-Hosted** — Deploy with a single `docker-compose up` command. Runs on any infrastructure: cloud VMs, on-premise servers, or even a Raspberry Pi for small teams.

**No Per-Seat Pricing** — One deployment supports your entire organization. Scale to hundreds of concurrent users without scaling costs.

## Features

### Real-Time Messaging
- Instant message delivery via WebSockets
- Channels (public and private) with membership management
- Direct messages (1:1 and group conversations)
- Message threading with dedicated thread panel
- Emoji reactions

### Organization & Discovery
- Workspaces with tenant isolation
- Channel directory for browsing and joining
- Full-text search across all accessible messages
- Member profiles with avatars

### Attention Management
- @user, @channel, and @here mentions
- Real-time notifications with customizable settings
- Per-channel mute and mention-only modes
- Unread counts and mark-as-read

### Presence
- Online/away/offline status indicators
- Real-time presence updates across all clients

### Mobile & Offline
- Progressive Web App (PWA) with install prompt
- Offline message queue with automatic sync
- Push notifications (Web Push API)
- Responsive mobile layout

### Self-Hosted Ready
- Single-command Docker deployment
- PostgreSQL backup and restore scripts
- GDPR-compliant data export
- Admin dashboard with audit logs
- No external service dependencies

## Tech Stack

- **Frontend:** Next.js 15, React, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Socket.IO, Drizzle ORM
- **Database:** PostgreSQL with native full-text search
- **Real-Time:** Socket.IO with Redis pub/sub for horizontal scaling
- **Deployment:** Docker Compose with nginx reverse proxy

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional) SMTP server for email verification

### Deploy

```bash
# Clone the repository
git clone https://github.com/ram-shortage/ocomms.git
cd ocomms

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# At minimum, set:
# - DATABASE_URL
# - BETTER_AUTH_SECRET
# - NEXT_PUBLIC_APP_URL

# Start all services
docker-compose up -d
```

The application will be available at `http://localhost` (or your configured domain).

### Development

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis (dev containers)
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BETTER_AUTH_SECRET` | Secret for session encryption | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL of your deployment | Yes |
| `REDIS_URL` | Redis connection for scaling (optional) | No |
| `SMTP_HOST` | SMTP server for emails | No |
| `SMTP_PORT` | SMTP port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |

### Backup & Restore

```bash
# Create backup
docker-compose exec db /backups/backup.sh

# List backups
ls backups/

# Restore from backup
docker-compose exec db /backups/restore.sh /backups/ocomms_YYYYMMDD_HHMMSS.dump
```

### Data Export

For GDPR compliance or data portability:

```bash
# CLI export
npx tsx scripts/export-data.ts <organization-id> ./export

# Or via API (requires owner role)
curl -X POST https://your-domain/api/admin/export \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "your-org-id"}'
```

## Testing

OComms maintains comprehensive test coverage across all layers:

```bash
# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage
```

**Test Suite:** 640+ tests covering:
- Socket.IO message and thread handlers
- API route authentication and authorization
- Server actions and business logic
- Data integrity and concurrency
- UI components with React Testing Library
- Accessibility (WCAG 2.1 compliance)
- PWA/offline functionality

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   nginx     │────▶│   Next.js   │────▶│ PostgreSQL  │
│   :80/443   │     │   + Socket  │     │   :5432     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Redis    │
                    │   :6379     │
                    └─────────────┘
```

- **nginx** — Reverse proxy with WebSocket upgrade support
- **Next.js + Socket.IO** — Application server handling HTTP and WebSocket connections
- **PostgreSQL** — Primary database with full-text search
- **Redis** — Pub/sub for real-time message distribution across instances (optional for single-instance deployments)

## Roadmap

**Current Version: v0.3.0** — Mobile & Polish

Completed milestones:
- **v0.1.0** — Full conversation features (channels, DMs, threads, search)
- **v0.2.0** — Security hardening (HSTS, rate limiting, audit logging)
- **v0.3.0** — Mobile experience (PWA, offline, push notifications)

Future versions may include:
- [ ] Message editing
- [ ] Rich text formatting
- [ ] Custom emoji
- [ ] File uploads and sharing
- [ ] SSO/SAML integration
- [ ] Custom status with expiration
- [ ] Do Not Disturb schedules

See [.planning/PROJECT.md](.planning/PROJECT.md) for detailed planning documents.

## Contributing

Contributions are welcome! Please read the codebase documentation in `.planning/` to understand the architecture and conventions.

## License

[MIT](LICENSE)

---

Built with the belief that team communication tools shouldn't require giving up control of your data.
