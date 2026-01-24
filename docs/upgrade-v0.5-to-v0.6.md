# Upgrading OComms from v0.5 to v0.6

This guide covers upgrading an existing OComms v0.5.x deployment to v0.6.0.

---

## What's New in v0.6.0

### Security Enhancements (22 fixes)
- TOTP MFA with backup codes
- CSP nonce-based script loading
- Server-side session validation with immediate revocation
- SVG upload blocking with content detection
- Socket.IO rate limiting for all handlers
- Password breach detection via bloom filter
- Password history enforcement
- Per-user storage quota tracking
- HMAC-signed audit logs
- SSRF DNS rebinding protection
- Subresource Integrity for static assets

### New Features
- Workspace switcher with unread counts
- Browse and join available workspaces
- Join request approval workflow
- Sidebar drag-and-drop reordering (categories, channels, DMs)
- Per-user sidebar preferences with cross-device sync
- Mobile More menu for Scheduled/Reminders/Saved
- Mobile-optimized emoji picker

### Architecture Changes
- **Worker service removed** - Background jobs now run within the main `app` container
- New database tables for MFA, workspace join requests, and sidebar preferences

---

## Pre-Upgrade Checklist

- [ ] Backup your database
- [ ] Note your current `.env` configuration
- [ ] Ensure you have SSH access to your server
- [ ] Plan for 2-5 minutes of downtime

---

## Upgrade Steps

### Step 1: Backup Database

```bash
cd /opt/ocomms

# Create a timestamped backup
docker compose exec -T db pg_dump -U postgres ocomms > ./backups/ocomms-pre-v0.6-$(date +%Y%m%d-%H%M%S).sql

# Verify backup was created
ls -la ./backups/
```

### Step 2: Stop Services

```bash
docker compose down
```

### Step 3: Pull Latest Code

```bash
git fetch origin
git checkout v0.6.0  # Or: git pull origin master
```

### Step 4: Update Environment Variables

Edit your `.env` file to add the new v0.6.0 variables:

```bash
nano .env
```

Add these new variables:

```bash
# ===================
# NEW IN v0.6.0
# ===================

# Audit log integrity (required for tamper detection)
# Generate with: openssl rand -hex 32
AUDIT_LOG_SECRET=your-generated-32-byte-hex-secret

# Socket.IO CORS whitelist (optional)
# Defaults to NEXT_PUBLIC_APP_URL if not set
# ALLOWED_ORIGINS=https://chat.example.com,https://admin.example.com

# Redirect URL validation (optional)
# Defaults to NEXT_PUBLIC_APP_URL hostname if not set
# Supports exact match and subdomain match (prefix with .)
# ALLOWED_REDIRECT_DOMAINS=chat.example.com,.example.com
```

Generate the audit log secret:

```bash
openssl rand -hex 32
```

Copy the output and set it as your `AUDIT_LOG_SECRET` value.

### Step 5: Remove Worker References (if any)

If you have any custom scripts or cron jobs referencing the `worker` container, update them. The worker functionality is now integrated into the main `app` container.

**Old command (no longer works):**
```bash
docker compose restart worker  # This will fail
```

**New command:**
```bash
docker compose restart app  # Background jobs run in app container
```

### Step 6: Rebuild and Start

```bash
# Rebuild the app image with new code
docker compose build --no-cache app

# Start all services
docker compose up -d
```

### Step 7: Run Database Migrations

v0.6.0 includes 4 new migrations:
- `0005` - Password history table and two-factor flag
- `0006` - Two-factor table and workspace join requests
- `0007` - Workspace join policy and description
- `0008` - User sidebar preferences

Run migrations:

```bash
docker compose exec app node migrate.mjs
```

You should see output like:
```
Running database migrations...
Migrations complete
```

### Step 8: Verify Deployment

```bash
# Check container status
docker compose ps

# Check app logs for errors
docker compose logs --tail=50 app

# Test health endpoint
curl https://your-domain.com/api/health
```

### Step 9: Test New Features

1. **MFA Setup** - Navigate to Settings > Security to enable two-factor authentication
2. **Workspace Switcher** - Click workspace name in sidebar to see the new switcher
3. **Sidebar Reordering** - Try dragging channels or categories to reorder them
4. **Mobile Menu** - On mobile, check the "More" menu for Scheduled/Reminders/Saved

---

## Rollback Procedure

If you encounter issues:

```bash
# Stop services
docker compose down

# Restore database from backup
docker compose up -d db
sleep 10  # Wait for database to start
docker compose exec -T db psql -U postgres -d ocomms < ./backups/ocomms-pre-v0.6-YYYYMMDD-HHMMSS.sql

# Checkout previous version
git checkout v0.5.0

# Rebuild and start
docker compose build --no-cache app
docker compose up -d
```

---

## Breaking Changes

### Worker Container Removed

The separate `worker` service no longer exists. If you have monitoring or scripts that check worker health, update them to monitor the `app` container instead.

**Before (v0.5):**
```bash
docker compose ps worker
docker compose logs worker
```

**After (v0.6):**
```bash
docker compose ps app
docker compose logs app
```

### New Database Columns

The following columns are added and have default values (no action needed):
- `users.two_factor_enabled` (default: false)
- `organizations.join_policy` (default: 'invite_only')
- `organizations.description` (default: null)

### New Tables

The following tables are created by migrations:
- `password_history` - Stores password hashes for reuse prevention
- `two_factor` - Stores TOTP secrets and backup codes
- `workspace_join_requests` - Stores workspace join requests
- `user_sidebar_preferences` - Stores per-user sidebar layout preferences

---

## Troubleshooting

### Migration Fails with "relation already exists"

This can happen if a previous migration partially completed. Check which migrations have run:

```bash
docker compose exec db psql -U postgres -d ocomms -c "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

### App Won't Start After Upgrade

Check logs for specific errors:

```bash
docker compose logs --tail=100 app
```

Common issues:
- Missing `AUDIT_LOG_SECRET` - Generate and add to `.env`
- Database connection issues - Ensure `db` container is healthy

### Socket.IO Connection Failures

If you're using a CDN or proxy that has a different origin:

1. Add the origin to `ALLOWED_ORIGINS` in `.env`:
   ```bash
   ALLOWED_ORIGINS=https://chat.example.com,https://cdn.example.com
   ```

2. Restart the app:
   ```bash
   docker compose restart app
   ```

---

## Post-Upgrade Recommendations

1. **Enable MFA for Admin Accounts** - Go to Settings > Security
2. **Review Workspace Join Policy** - By default, workspaces are invite-only
3. **Test Backup/Restore** - Verify your backup strategy works with the new schema
4. **Update Monitoring** - Remove worker container checks, add checks for new features

---

*Last updated: 2026-01-24 (v0.6.0)*
