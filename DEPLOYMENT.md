# OComms Deployment Documentation

A comprehensive guide for deploying OComms, a self-hosted team communication platform.

---

## Table of Contents

1. [Quickstart Guide](#quickstart-guide-experienced-users)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Deployment](#step-by-step-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Worker Processes](#worker-processes)
8. [Scaling & Production Considerations](#scaling--production-considerations)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance & Backup](#maintenance--backup)

---

## Quickstart Guide (Experienced Users)

For those familiar with Docker, Node.js, and web application deployment:

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

**Stack:** Next.js 16, PostgreSQL 16, Redis 7, Socket.IO, BullMQ, Nginx + Let's Encrypt

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 1GB | 2GB+ |
| CPU | 1 core | 2+ cores |
| Disk | 10GB | 20GB+ SSD |
| Network | 100Mbps | 1Gbps |

### Software Requirements

- **Operating System:** Linux (Ubuntu 22.04 LTS recommended)
- **Docker Engine:** Version 24.0 or higher
- **Docker Compose:** Version 2.0 or higher (included with Docker Desktop)
- **Domain Name:** A registered domain with DNS access
- **Git:** For cloning the repository

### Network Requirements

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access (administration) |
| 80 | TCP | HTTP (redirects to HTTPS) |
| 443 | TCP | HTTPS (main application) |

### Optional Services

- **SMTP Server:** For email verification and invitations
- **External Redis:** For high-availability deployments

---

## Step-by-Step Deployment

### Phase 1: Server Preparation

#### Step 1.1: Update Your Server

Connect to your server via SSH and update the system:

```bash
# Connect to your server
ssh your-user@your-server-ip

# Update package lists and upgrade existing packages
sudo apt update && sudo apt upgrade -y
```

#### Step 1.2: Install Docker

```bash
# Install required packages
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to the docker group (avoids needing sudo)
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
```

After logging back in, verify Docker is installed:

```bash
docker --version
docker compose version
```

#### Step 1.3: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable

# Verify rules
sudo ufw status
```

### Phase 2: DNS Configuration

#### Step 2.1: Configure DNS Records

Log into your domain registrar or DNS provider and create the following record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ (or subdomain) | Your server's public IP | 300 |

**Example:** If your server IP is `203.0.113.50` and domain is `chat.example.com`:
- Type: A
- Name: chat
- Value: 203.0.113.50

#### Step 2.2: Verify DNS Propagation

Wait for DNS propagation (can take 5-30 minutes) and verify:

```bash
# On your local machine or server
nslookup chat.example.com
# or
dig chat.example.com +short
```

The response should show your server's IP address.

### Phase 3: Application Setup

#### Step 3.1: Clone the Repository

```bash
# Navigate to your preferred directory
cd /opt

# Clone the repository
sudo git clone https://github.com/ram-shortage/ocomms.git

# Change ownership to your user
sudo chown -R $USER:$USER ocomms

# Enter the directory
cd ocomms
```

#### Step 3.2: Create Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Open the file for editing
nano .env
```

See the [Environment Configuration](#environment-configuration) section for detailed variable explanations.

#### Step 3.3: Generate Required Secrets

Generate the authentication secrets:

```bash
# Generate a random secret (run twice for each secret)
openssl rand -base64 32
```

Generate VAPID keys for push notifications:

```bash
# Install web-push globally if needed
npm install -g web-push

# Generate VAPID keys
npx web-push generate-vapid-keys
```

This outputs:
```
Public Key: BExamplePublicKeyHere...
Private Key: ExamplePrivateKeyHere...
```

Copy these values to your `.env` file.

#### Step 3.4: Configure Minimum Required Variables

Edit your `.env` file with these essential values:

```bash
# Database
DATABASE_URL=postgresql://postgres:your-secure-password@db:5432/ocomms
DB_PASSWORD=your-secure-password

# Authentication (use the secrets you generated)
BETTER_AUTH_SECRET=your-generated-secret-1
AUTH_SECRET=your-generated-secret-2
BETTER_AUTH_URL=https://your-domain.com

# Application URLs
APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# SSL Certificate (your email for Let's Encrypt notifications)
CERTBOT_EMAIL=admin@your-domain.com
CERTBOT_STAGING=1  # Keep as 1 for initial testing, change to 0 for production

# Redis (internal Docker network)
REDIS_URL=redis://redis:6379
```

### Phase 4: Launch the Application

#### Step 4.1: Start Docker Containers

```bash
# Build and start all services in detached mode
docker compose up -d
```

This starts:
- **app:** The main OComms application (Next.js + Socket.IO)
- **worker:** Background job processor
- **db:** PostgreSQL database
- **redis:** Redis for caching and real-time features
- **nginx:** Reverse proxy with SSL

#### Step 4.2: Monitor Startup Progress

```bash
# View logs from all containers
docker compose logs -f

# Or view specific service logs
docker compose logs -f app
docker compose logs -f nginx
```

Wait until you see:
- `app` shows: "Server running on port 3000"
- `nginx` shows successful certificate acquisition (may take 1-2 minutes)

#### Step 4.3: Run Database Migrations

```bash
# Execute migrations inside the app container
docker compose exec app npm run db:migrate
```

#### Step 4.4: Verify Deployment

1. Open your browser and navigate to `https://your-domain.com`
2. You should see the OComms login page
3. Register a new account to verify functionality

#### Step 4.5: Switch to Production SSL

Once everything works with staging certificates:

```bash
# Edit .env and change:
CERTBOT_STAGING=0

# Restart nginx to get production certificates
docker compose restart nginx
```

### Phase 5: Post-Deployment Configuration

#### Step 5.1: Create Initial Admin User

Register via the web interface:
1. Navigate to `https://your-domain.com`
2. Click "Sign Up"
3. Enter your email and password
4. Create your first workspace

#### Step 5.2: Configure Email (Optional but Recommended)

Edit `.env` to add SMTP settings:

```bash
SMTP_HOST=smtp.your-email-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@your-domain.com
```

Restart the app container:

```bash
docker compose restart app
```

#### Step 5.3: Enable Push Notifications (Optional)

Ensure VAPID keys are configured in `.env`:

```bash
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:admin@your-domain.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key
```

Restart containers:

```bash
docker compose restart app worker
```

---

## Environment Configuration

### Complete Environment Variable Reference

#### Core Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | development | Set to `production` for production deployments |
| `PORT` | No | 3000 | Application port (internal) |
| `HOST` | No | 0.0.0.0 | Application host binding |

#### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DB_PASSWORD` | Yes | - | Database password (must match DATABASE_URL) |

**Connection String Format:**
```
postgresql://username:password@host:port/database?sslmode=require
```

#### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTER_AUTH_SECRET` | Yes | - | Secret for signing auth tokens (min 32 chars) |
| `AUTH_SECRET` | Yes | - | Additional auth secret (min 32 chars) |
| `BETTER_AUTH_URL` | Yes | - | Full URL of your application |

#### Application URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_URL` | Yes | - | Base URL for server-side operations |
| `NEXT_PUBLIC_APP_URL` | Yes | - | Base URL for client-side (must match APP_URL) |

#### SSL/TLS (Let's Encrypt)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CERTBOT_EMAIL` | Yes | - | Email for Let's Encrypt notifications |
| `CERTBOT_STAGING` | No | 1 | Use staging certs (1) or production (0) |

#### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | - | Redis connection URL for scaling features |

#### SMTP (Email)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | - | SMTP server hostname |
| `SMTP_PORT` | No | 587 | SMTP server port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASS` | No | - | SMTP password |
| `EMAIL_FROM` | No | - | From address for outgoing emails |

#### Push Notifications (VAPID)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | No | - | VAPID public key |
| `VAPID_PRIVATE_KEY` | No | - | VAPID private key |
| `VAPID_SUBJECT` | No | - | VAPID subject (mailto: URL) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | - | Public VAPID key (client-side) |

### Example Production .env

```bash
# ===================
# CORE CONFIGURATION
# ===================
NODE_ENV=production

# ===================
# DATABASE
# ===================
DATABASE_URL=postgresql://postgres:SuperSecurePassword123!@db:5432/ocomms
DB_PASSWORD=SuperSecurePassword123!

# ===================
# AUTHENTICATION
# ===================
BETTER_AUTH_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
AUTH_SECRET=q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6
BETTER_AUTH_URL=https://chat.example.com

# ===================
# APPLICATION URLs
# ===================
APP_URL=https://chat.example.com
NEXT_PUBLIC_APP_URL=https://chat.example.com

# ===================
# SSL CERTIFICATE
# ===================
CERTBOT_EMAIL=admin@example.com
CERTBOT_STAGING=0

# ===================
# REDIS
# ===================
REDIS_URL=redis://redis:6379

# ===================
# EMAIL (Optional)
# ===================
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key-here
EMAIL_FROM=noreply@example.com

# ===================
# PUSH NOTIFICATIONS (Optional)
# ===================
VAPID_PUBLIC_KEY=BExampleVAPIDPublicKey...
VAPID_PRIVATE_KEY=ExampleVAPIDPrivateKey...
VAPID_SUBJECT=mailto:admin@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExampleVAPIDPublicKey...
```

---

## Database Setup

### Initial Migration

After starting containers, run migrations:

```bash
docker compose exec app npm run db:migrate
```

### Database Management Commands

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema changes (development) |
| `npm run db:studio` | Open Drizzle Studio GUI |
| `npm run db:seed` | Load test data |
| `npm run db:reset` | Reset database (WARNING: destructive) |

### Accessing the Database

```bash
# Connect to PostgreSQL CLI
docker compose exec db psql -U postgres -d ocomms

# Run a query
\dt  # List all tables
\q   # Exit
```

### Database Schema Overview

OComms uses the following main entities:

- **Users & Accounts:** User authentication and profiles
- **Organizations:** Workspaces/teams
- **Channels:** Public and private channels
- **Conversations:** Direct messages
- **Messages:** All message content with threading support
- **Notifications:** In-app and push notifications
- **Reminders:** Scheduled message reminders

---

## SSL/TLS Configuration

### Automatic Certificate Management

The included Nginx configuration uses `jonasal/nginx-certbot` for automatic Let's Encrypt certificate management.

### Certificate Workflow

1. **Initial Setup:** Certbot obtains certificates automatically on first run
2. **Renewal:** Certificates auto-renew before expiration
3. **Staging vs Production:**
   - `CERTBOT_STAGING=1`: Uses Let's Encrypt staging (for testing, not trusted by browsers)
   - `CERTBOT_STAGING=0`: Uses Let's Encrypt production (trusted certificates)

### Switching to Production Certificates

```bash
# 1. Edit .env
nano .env
# Change: CERTBOT_STAGING=0

# 2. Remove old certificates
docker compose exec nginx rm -rf /etc/letsencrypt/live/*
docker compose exec nginx rm -rf /etc/letsencrypt/archive/*
docker compose exec nginx rm -rf /etc/letsencrypt/renewal/*

# 3. Restart nginx
docker compose restart nginx

# 4. Monitor certificate acquisition
docker compose logs -f nginx
```

### Custom SSL Certificates

To use your own certificates instead of Let's Encrypt:

1. Place certificates in `./certs/`:
   ```
   ./certs/fullchain.pem
   ./certs/privkey.pem
   ```

2. Update `nginx/conf.d/default.conf`:
   ```nginx
   ssl_certificate /etc/nginx/certs/fullchain.pem;
   ssl_certificate_key /etc/nginx/certs/privkey.pem;
   ```

3. Mount in `docker-compose.yml`:
   ```yaml
   nginx:
     volumes:
       - ./certs:/etc/nginx/certs:ro
   ```

---

## Worker Processes

OComms uses background worker processes for asynchronous tasks.

### Worker Functions

| Worker | Purpose |
|--------|---------|
| Scheduled Messages | Sends messages at scheduled times |
| Reminders | Triggers reminder notifications |
| Status Expiration | Clears expired user statuses |
| Link Preview | Generates URL previews |
| Guest Expiration | Handles guest account cleanup |

### Worker Health Check

```bash
# View worker logs
docker compose logs -f worker

# Check worker status
docker compose ps worker
```

### Manual Worker Restart

```bash
docker compose restart worker
```

---

## Scaling & Production Considerations

### Single Server Deployment

The default `docker-compose.yml` is suitable for:
- Up to ~500 concurrent users
- Small to medium teams
- Single server deployments

### Horizontal Scaling

For larger deployments:

#### Multiple App Instances

```yaml
# docker-compose.yml modifications
services:
  app:
    deploy:
      replicas: 3
```

Requirements for scaling:
- **Redis required:** Socket.IO uses Redis for pub/sub across instances
- **Shared storage:** Mount `public/uploads/` on shared storage (NFS, S3)
- **Load balancer:** Use nginx with upstream configuration

#### External Database

For high availability, use a managed PostgreSQL service:

```bash
DATABASE_URL=postgresql://user:pass@your-rds-instance.amazonaws.com:5432/ocomms?sslmode=require
```

#### External Redis

For high availability:

```bash
REDIS_URL=redis://:password@your-redis-cluster.amazonaws.com:6379
```

### Performance Tuning

#### Nginx Worker Connections

Edit `nginx/conf.d/default.conf`:

```nginx
events {
    worker_connections 2048;
}
```

#### Node.js Memory

Edit `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
```

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker compose logs app

# Check container status
docker compose ps

# Restart all containers
docker compose down && docker compose up -d
```

#### Database Connection Error

```bash
# Verify database is running
docker compose ps db

# Check database logs
docker compose logs db

# Test connection manually
docker compose exec db pg_isready
```

#### SSL Certificate Issues

```bash
# Check nginx logs
docker compose logs nginx

# Verify certificate status
docker compose exec nginx ls -la /etc/letsencrypt/live/

# Force certificate renewal
docker compose exec nginx certbot renew --force-renewal
```

#### WebSocket Connection Failures

Check nginx configuration allows WebSocket upgrades:

```nginx
location /socket.io/ {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_pass http://app:3000;
}
```

#### Redis Connection Issues

```bash
# Check Redis is running
docker compose exec redis redis-cli ping
# Should return: PONG

# Check Redis logs
docker compose logs redis
```

### Health Check Endpoint

The application provides a health check endpoint:

```bash
curl https://your-domain.com/api/health
```

Returns:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Debug Mode

Enable debug logging:

```bash
# Add to .env
DEBUG=ocomms:*

# Restart containers
docker compose restart app
```

---

## Maintenance & Backup

### Database Backup

#### Manual Backup

```bash
# Create backup directory
mkdir -p ./backups

# Run backup
docker compose exec db pg_dump -U postgres ocomms > ./backups/ocomms-$(date +%Y%m%d-%H%M%S).sql
```

#### Automated Backups

Create a cron job:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /opt/ocomms && docker compose exec -T db pg_dump -U postgres ocomms > ./backups/ocomms-$(date +\%Y\%m\%d).sql
```

### Database Restore

```bash
# Stop the app
docker compose stop app worker

# Restore from backup
docker compose exec -T db psql -U postgres -d ocomms < ./backups/ocomms-20240115.sql

# Restart services
docker compose start app worker
```

### Application Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker compose build
docker compose up -d

# Run any new migrations
docker compose exec app npm run db:migrate
```

### Log Management

#### View Logs

```bash
# All services
docker compose logs -f

# Specific service with timestamps
docker compose logs -f --timestamps app
```

#### Log Rotation

Docker handles log rotation automatically. To configure:

```yaml
# docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitoring Recommendations

- **Uptime monitoring:** Use services like UptimeRobot or Pingdom
- **Container monitoring:** Docker stats, Portainer, or Prometheus
- **Log aggregation:** Consider ELK stack or Loki for production

---

## Deployment Checklist

### Pre-Deployment

- [ ] Server meets minimum requirements
- [ ] Docker and Docker Compose installed
- [ ] Domain DNS configured and propagated
- [ ] Firewall ports 80 and 443 open
- [ ] `.env` file created with all required variables
- [ ] Secrets generated (auth secrets, VAPID keys)

### Deployment

- [ ] Repository cloned
- [ ] Docker containers started successfully
- [ ] SSL certificates obtained
- [ ] Database migrations completed
- [ ] Application accessible via HTTPS

### Post-Deployment

- [ ] First user account created
- [ ] SMTP configured (if using email features)
- [ ] Push notifications tested (if configured)
- [ ] Backup strategy implemented
- [ ] `CERTBOT_STAGING` set to `0` for production certificates

### Security Hardening

- [ ] Strong database password set
- [ ] Auth secrets are unique and secure
- [ ] SSH key-based authentication only
- [ ] Firewall configured
- [ ] Regular security updates scheduled

---

## Support & Resources

- **Issues:** Report bugs at [GitHub Issues](https://github.com/ram-shortage/ocomms/issues)
- **Documentation:** Additional docs in the `/docs` directory
- **Updates:** Check release notes for upgrade instructions

---

*Last updated: 2026-01-21 (v0.5.0)*
