# OComms User Setup Guide

Complete guide for deploying and configuring OComms on your own infrastructure.

**Estimated time:** 30-45 minutes for initial deployment, plus ongoing maintenance tasks as needed.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Deployment](#initial-deployment)
3. [First-Time Setup](#first-time-setup)
4. [Push Notifications Configuration](#push-notifications-configuration)
5. [Backup and Restore](#backup-and-restore)
6. [Updating OComms](#updating-ocomms)
7. [Data Export](#data-export)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying OComms, ensure you have the following:

### Required

- **Docker** (version 24.0 or later)
- **Docker Compose** (version 2.20 or later, or Docker Desktop with Compose V2)
- **Domain name** with DNS configured to point to your server
- **SSL certificate** (Let's Encrypt is recommended and automated in the deployment)
- **Server** with at least 1GB RAM (2GB recommended for production)

### Optional

- **SMTP server** for email verification and notifications
- **Redis** is included in the Docker Compose stack for horizontal scaling

### Verify Docker Installation

```bash
# Check Docker version
docker --version
# Expected: Docker version 24.0.0 or later

# Check Docker Compose version
docker compose version
# Expected: Docker Compose version v2.20.0 or later
```

---

## Initial Deployment

**Estimated time:** 15-20 minutes

### Step 1: Clone the Repository

```bash
git clone https://github.com/ram-shortage/ocomms.git
cd ocomms
```

### Step 2: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your settings. The following variables are required:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (auto-configured for Docker) | `postgresql://postgres:yourpassword@db:5432/ocomms?sslmode=require` |
| `DB_PASSWORD` | PostgreSQL password | A strong password (16+ characters) |
| `BETTER_AUTH_SECRET` | Secret for session encryption | Generate with: `openssl rand -base64 32` |
| `AUTH_SECRET` | Same as BETTER_AUTH_SECRET | Same value as above |
| `APP_URL` | Public URL of your deployment | `https://chat.yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Same as APP_URL (for client-side) | `https://chat.yourdomain.com` |
| `BETTER_AUTH_URL` | Same as APP_URL (for auth library) | `https://chat.yourdomain.com` |
| `CERTBOT_EMAIL` | Email for Let's Encrypt notifications | `admin@yourdomain.com` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://redis:6379` (internal Docker network) |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `EMAIL_FROM` | From address for emails | - |
| `CERTBOT_STAGING` | Use Let's Encrypt staging (for testing) | `1` (set to `0` for production) |

#### Example Production Configuration

```bash
# Database
DATABASE_URL=postgresql://postgres:your-secure-password@db:5432/ocomms?sslmode=require
DB_PASSWORD=your-secure-password

# Auth (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-generated-secret-here
AUTH_SECRET=your-generated-secret-here

# URLs
APP_URL=https://chat.yourdomain.com
NEXT_PUBLIC_APP_URL=https://chat.yourdomain.com
BETTER_AUTH_URL=https://chat.yourdomain.com

# SSL
CERTBOT_EMAIL=admin@yourdomain.com
CERTBOT_STAGING=0

# SMTP (optional)
SMTP_HOST=smtp.yourmailprovider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
```

### Step 3: Configure nginx Domain

Edit `nginx/conf.d/default.conf` and replace `example.com` with your domain:

```bash
# Find and replace example.com with your domain
sed -i 's/example.com/yourdomain.com/g' nginx/conf.d/default.conf
```

Or manually edit the file and replace these lines:

```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### Step 4: Generate Database SSL Certificates

```bash
# Generate self-signed certificates for PostgreSQL
./scripts/generate-db-certs.sh
```

This creates certificates in `certs/postgres/` for encrypted database connections.

### Step 5: Start Services

```bash
# Start all services in the background
docker compose up -d
```

The first startup will:
1. Build the application container
2. Start PostgreSQL and wait for it to be healthy
3. Start Redis
4. Start the application
5. Start nginx with automatic SSL certificate acquisition

### Step 6: Initialize the Database

```bash
# Run database migrations
docker compose exec app npm run db:push
```

### Step 7: Verify Deployment

```bash
# Check all services are running
docker compose ps

# Check application health
curl -s https://yourdomain.com/api/health
```

The application should now be available at `https://yourdomain.com`.

---

## First-Time Setup

**Estimated time:** 5 minutes

### Create Your Organization

1. Navigate to `https://yourdomain.com` in your browser
2. Click "Sign up" to create your account
3. Verify your email (if SMTP is configured)
4. Create a new organization - this will be your workspace

### First User Becomes Owner

The first user to create an organization automatically becomes the **owner** with full administrative privileges:

- Manage organization settings
- Invite and remove members
- Create and manage channels
- Access admin features (data export, audit logs)

### Invite Team Members

1. Go to **Settings** (gear icon)
2. Navigate to the **Members** section
3. Click **Invite Members**
4. Share the invite link with your team

Members can join via:
- Direct invite link
- Email invitation (if SMTP configured)

---

## Push Notifications Configuration

**Estimated time:** 5 minutes

Push notifications require VAPID (Voluntary Application Server Identification) keys for web push authentication.

### Step 1: Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

This outputs two keys:
```
Public Key:
BLnkz3...your-public-key...xyz

Private Key:
abc123...your-private-key...def
```

### Step 2: Add to Environment

Add the following to your `.env` file:

```bash
# Web Push VAPID keys
VAPID_PUBLIC_KEY=BLnkz3...your-public-key...xyz
VAPID_PRIVATE_KEY=abc123...your-private-key...def
VAPID_SUBJECT=mailto:admin@yourdomain.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLnkz3...your-public-key...xyz
```

Note: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be the same as `VAPID_PUBLIC_KEY`.

### Step 3: Restart Services

```bash
docker compose down
docker compose up -d
```

### Step 4: Verify Configuration

1. Log into OComms
2. Go to **Settings** > **Notifications**
3. Click "Enable push notifications"
4. Accept the browser permission prompt

Users will now receive push notifications for:
- Direct messages
- @mentions
- Channel messages (based on notification settings)

---

## Backup and Restore

### Automated Backups

The backup system uses PostgreSQL's native dump format for reliable, consistent backups.

#### Create a Backup

```bash
docker compose exec db /backups/backup.sh
```

Output:
```
=== OComms Database Backup ===
Database: ocomms
Backup created: /backups/ocomms_20260119_103045.dump
Backup verification passed.
=== Backup Complete ===
```

Backups are stored in the `backups/` directory on your host machine.

#### List Available Backups

```bash
ls -lh backups/
```

#### Automated Backup Schedule

For production deployments, schedule daily backups using cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/ocomms && docker compose exec -T db /backups/backup.sh >> /var/log/ocomms-backup.log 2>&1
```

### Restore from Backup

**Warning:** Restoring a backup will overwrite all current data.

```bash
# List available backups
ls backups/

# Restore from a specific backup
docker compose exec db /backups/restore.sh /backups/ocomms_20260119_103045.dump
```

The restore script will:
1. Terminate existing database connections
2. Drop the current database
3. Create a fresh database
4. Restore from the backup file
5. Prompt for confirmation before proceeding

After restore, restart the application:

```bash
docker compose restart app
```

### Backup Retention

By default, backups older than 7 days are automatically deleted during each backup run. Adjust this by setting `RETENTION_DAYS`:

```bash
RETENTION_DAYS=30 docker compose exec db /backups/backup.sh
```

---

## Updating OComms

**Estimated time:** 5-10 minutes (depending on build time)

### Standard Update Process

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild containers
docker compose build

# 3. Run database migrations
docker compose exec app npm run db:push

# 4. Restart services
docker compose up -d
```

### Update with Zero Downtime (Advanced)

For production environments requiring minimal downtime:

```bash
# 1. Pull and build in background
git pull origin main
docker compose build

# 2. Stop and restart (brief downtime for migrations)
docker compose down
docker compose exec app npm run db:push
docker compose up -d
```

### Rollback to Previous Version

If an update causes issues:

```bash
# 1. Check out previous version
git checkout HEAD~1

# 2. Rebuild and restart
docker compose build
docker compose up -d

# 3. Restore database backup if needed
docker compose exec db /backups/restore.sh /backups/your-backup.dump
docker compose restart app
```

---

## Data Export

OComms provides GDPR-compliant data export for full data portability.

### Export via Admin UI

1. Log in as an organization owner
2. Go to **Settings** > **Admin**
3. Click **Export Data**
4. Select export options
5. Download the generated JSON files

### Export via CLI

For automated or scripted exports:

```bash
npx tsx scripts/export-data.ts <organization-id> ./export
```

Example:
```bash
npx tsx scripts/export-data.ts 123e4567-e89b-12d3-a456-426614174000 ./export
```

This creates a timestamped directory containing:
- `manifest.json` - Export metadata and counts
- `organization.json` - Organization details
- `members.json` - Members with profiles
- `channels.json` - Channels with messages and reactions
- `direct-messages.json` - Conversations with messages
- `pinned-messages.json` - Pinned message references
- `notifications.json` - User notifications
- `channel-notification-settings.json` - Per-channel settings
- `read-states.json` - Message read tracking

### GDPR Compliance

The export includes all user-generated content and metadata:
- All messages sent by users
- Reactions and mentions
- Profile information
- Notification preferences
- Read state history

Sensitive authentication data (password hashes, sessions) is excluded from exports.

---

## Troubleshooting

### Viewing Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs app
docker compose logs db
docker compose logs nginx

# Follow logs in real-time
docker compose logs -f app

# Last 100 lines
docker compose logs --tail=100 app
```

### Common Issues

#### Database Connection Errors

**Symptom:** Application fails to start with "Connection refused" or "ECONNREFUSED"

**Solutions:**

1. Check database container is running:
   ```bash
   docker compose ps db
   ```

2. Verify database is healthy:
   ```bash
   docker compose exec db pg_isready -U postgres
   ```

3. Check database logs:
   ```bash
   docker compose logs db
   ```

4. Verify `DATABASE_URL` in `.env` uses `db` as hostname (Docker network):
   ```
   DATABASE_URL=postgresql://postgres:password@db:5432/ocomms?sslmode=require
   ```

#### WebSocket Connection Issues

**Symptom:** Real-time messages not working, "WebSocket connection failed" in browser console

**Solutions:**

1. Verify nginx WebSocket configuration in `nginx/conf.d/default.conf`:
   ```nginx
   location /socket.io/ {
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       # ... other headers
   }
   ```

2. Check nginx logs:
   ```bash
   docker compose logs nginx
   ```

3. Test WebSocket endpoint:
   ```bash
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
        https://yourdomain.com/socket.io/?EIO=4&transport=websocket
   ```

#### SSL Certificate Issues

**Symptom:** Browser shows certificate errors, "NET::ERR_CERT_AUTHORITY_INVALID"

**Solutions:**

1. Ensure `CERTBOT_STAGING=0` in `.env` for production certificates

2. Check certbot logs:
   ```bash
   docker compose logs nginx | grep -i cert
   ```

3. Verify domain DNS is correctly configured:
   ```bash
   dig yourdomain.com +short
   ```

4. Force certificate renewal:
   ```bash
   docker compose exec nginx certbot renew --force-renewal
   docker compose restart nginx
   ```

#### Push Notifications Not Working

**Symptom:** Users don't receive push notifications, no permission prompt appears

**Solutions:**

1. Verify VAPID keys are configured in `.env`:
   ```bash
   grep VAPID .env
   ```

2. Ensure both `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are set to the same value

3. Check browser supports push notifications (requires HTTPS)

4. Clear service worker and re-register:
   - In Chrome: DevTools > Application > Service Workers > Unregister
   - Reload the page and re-enable notifications

5. Check application logs for push errors:
   ```bash
   docker compose logs app | grep -i push
   ```

#### High Memory Usage

**Symptom:** Container crashes with OOM, slow performance

**Solutions:**

1. Check container resource usage:
   ```bash
   docker stats
   ```

2. Increase Docker memory limits (if applicable)

3. For large deployments, consider horizontal scaling with Redis pub/sub

#### Application Won't Start

**Symptom:** Container exits immediately, health check fails

**Solutions:**

1. Check application logs:
   ```bash
   docker compose logs app
   ```

2. Verify all required environment variables are set:
   ```bash
   docker compose exec app env | grep -E '(DATABASE|AUTH|URL)'
   ```

3. Test database connection from app container:
   ```bash
   docker compose exec app npm run db:push
   ```

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/ram-shortage/ocomms/issues) for known problems
2. Review the application logs thoroughly
3. Open a new issue with:
   - OComms version (git commit hash)
   - Docker and Docker Compose versions
   - Relevant log output
   - Steps to reproduce

---

**Data Sovereignty Note:** All your communication data remains on infrastructure you control. No telemetry, analytics, or external API calls are made by OComms. Your deployment is completely self-contained.
