# Phase 1: User Setup Required

**Generated:** 2026-01-17
**Phase:** 1-foundation
**Status:** Incomplete

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `DATABASE_URL` | Local PostgreSQL instance or Docker container | `.env.local` |
| [ ] | `SMTP_HOST` | Email provider settings | `.env.local` |
| [ ] | `SMTP_PORT` | Email provider settings (typically 587) | `.env.local` |
| [ ] | `SMTP_USER` | Email provider credentials | `.env.local` |
| [ ] | `SMTP_PASS` | Email provider credentials | `.env.local` |
| [ ] | `EMAIL_FROM` | Your sending email address | `.env.local` |

## PostgreSQL Setup

### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb ocomms

# Update .env.local
DATABASE_URL=postgresql://localhost:5432/ocomms
```

### Option 2: Docker

```bash
# Start PostgreSQL container
docker run -d \
  --name ocomms-postgres \
  -e POSTGRES_DB=ocomms \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15

# Update .env.local
DATABASE_URL=postgresql://postgres:password@localhost:5432/ocomms
```

## Dashboard Configuration

- [ ] **Create database named 'ocomms'**
  - Location: psql or pgAdmin
  - Command: `createdb ocomms`

## SMTP Configuration

For local development, you can:

1. **Skip email** - Comment out email verification in auth config
2. **Use Mailhog** - Local SMTP testing
3. **Use Resend/Sendgrid** - Real email for testing

### Mailhog (local testing)

```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Update .env.local
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@localhost
```

View emails at http://localhost:8025

## Verification

After setup, run these commands:

```bash
# Push schema to database
npm run db:push

# Open Drizzle Studio to verify tables
npm run db:studio
```

Expected tables in Drizzle Studio:
- users
- sessions
- accounts
- verifications
- organizations
- members
- invitations

---
**Once all items complete:** Mark status as "Complete"
