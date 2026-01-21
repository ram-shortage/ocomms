# OComms Deployment on Hetzner CX22

A step-by-step guide for deploying OComms on a Hetzner CX22 cloud server with automatic GitHub Actions deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: Initial Server Access & SSH Setup](#part-1-initial-server-access--ssh-setup)
3. [Part 2: Server Preparation](#part-2-server-preparation)
4. [Part 3: DNS Configuration](#part-3-dns-configuration)
5. [Part 4: Deploy OComms](#part-4-deploy-ocomms)
6. [Part 5: Automatic Deployment with GitHub Actions](#part-5-automatic-deployment-with-github-actions)
7. [Part 6: Post-Deployment](#part-6-post-deployment)
8. [Quick Reference](#quick-reference)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, you'll need:

- Your Hetzner server IP address (from Hetzner Cloud Console)
- A domain name pointed to this IP (e.g., `chat.yourdomain.com`)
- The root password from Hetzner (sent via email or shown in console)

### Server Specs (CX22)

| Resource | Value |
|----------|-------|
| vCPUs | 2 |
| RAM | 4 GB |
| Storage | 40 GB SSD |
| Capacity | ~500 concurrent users |

---

## Part 1: Initial Server Access & SSH Setup

### Step 1.1: First Login via Hetzner Console

1. Go to [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Select your server → Click **Console** (top right)
3. Login as `root` with the password from Hetzner

### Step 1.2: Create Your User Account

```bash
# Create a new user (replace 'brett' with your username)
adduser brett

# Add to sudo group
usermod -aG sudo brett

# Test sudo works
su - brett
sudo whoami  # Should output: root
exit
```

### Step 1.3: Set Up SSH Keys (from your local machine)

On your **local Mac**, open a new terminal:

```bash
# Generate SSH key if you don't have one
[ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy your public key (we'll paste this on the server)
cat ~/.ssh/id_ed25519.pub
```

Copy the output (starts with `ssh-ed25519...`).

### Step 1.4: Add SSH Key to Server

Back in the **Hetzner console** (as root):

```bash
# Switch to your user
su - brett

# Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add your public key (paste the key you copied)
nano ~/.ssh/authorized_keys
# Paste your key, save with Ctrl+O, Enter, Ctrl+X

chmod 600 ~/.ssh/authorized_keys
```

### Step 1.5: Test SSH Connection

On your **local Mac**:

```bash
# Replace with your server IP
ssh brett@YOUR_SERVER_IP

# If it works, you should be logged in without a password
```

### Step 1.6: Secure SSH (disable password login)

Once SSH key login works, secure the server:

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Find and change these lines:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

# Save and restart SSH
sudo systemctl restart sshd
```

> **Warning:** Make sure SSH key login works before doing this step, or you'll be locked out!

---

## Part 2: Server Preparation

### Step 2.1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2.2: Install Docker

```bash
# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER

# IMPORTANT: Log out and back in for group to take effect
exit
```

SSH back in:

```bash
ssh brett@YOUR_SERVER_IP

# Verify Docker works
docker --version
docker compose version
```

### Step 2.3: Configure Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
sudo ufw status
```

---

## Part 3: DNS Configuration

### Step 3.1: Point Your Domain to Server

In your domain registrar (Cloudflare, Namecheap, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | chat (or @) | YOUR_SERVER_IP | 300 |

### Step 3.2: Verify DNS

Wait a few minutes, then:

```bash
# On your local machine or server
dig chat.yourdomain.com +short
# Should return your server IP
```

---

## Part 4: Deploy OComms

### Step 4.1: Clone Repository

```bash
# Create app directory
sudo mkdir -p /opt/ocomms
sudo chown $USER:$USER /opt/ocomms
cd /opt/ocomms

# Clone the repository
git clone https://github.com/ram-shortage/ocomms.git .
```

### Step 4.2: Generate Secrets

```bash
# Generate auth secrets (run twice, save both)
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
echo "AUTH_SECRET=$(openssl rand -base64 32)"

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
```

**Save these values** - you'll need them for `.env`.

### Step 4.3: Generate VAPID Keys (for push notifications)

```bash
# Install Node.js temporarily for key generation
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Generate VAPID keys
npx web-push generate-vapid-keys
```

**Save the Public Key and Private Key output.**

### Step 4.4: Create Environment File

```bash
cp .env.example .env
nano .env
```

Fill in your values:

```bash
# ===================
# CORE
# ===================
NODE_ENV=production

# ===================
# DATABASE (use the password you generated)
# ===================
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD_HERE@db:5432/ocomms
DB_PASSWORD=YOUR_DB_PASSWORD_HERE

# ===================
# AUTHENTICATION (use the secrets you generated)
# ===================
BETTER_AUTH_SECRET=YOUR_BETTER_AUTH_SECRET_HERE
AUTH_SECRET=YOUR_AUTH_SECRET_HERE
BETTER_AUTH_URL=https://chat.yourdomain.com

# ===================
# APPLICATION URLs (replace with your domain)
# ===================
APP_URL=https://chat.yourdomain.com
NEXT_PUBLIC_APP_URL=https://chat.yourdomain.com

# ===================
# SSL CERTIFICATE
# ===================
CERTBOT_EMAIL=your-email@example.com
CERTBOT_STAGING=1

# ===================
# REDIS
# ===================
REDIS_URL=redis://redis:6379

# ===================
# PUSH NOTIFICATIONS (from VAPID keys you generated)
# ===================
VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:your-email@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY

# ===================
# EMAIL (optional - add later if needed)
# ===================
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-smtp-user
# SMTP_PASS=your-smtp-password
# EMAIL_FROM=noreply@yourdomain.com
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

### Step 4.5: Start the Application

```bash
# Build and start all containers
docker compose up -d

# Watch the logs (Ctrl+C to exit)
docker compose logs -f
```

Wait for:
- `app` to show "Server running on port 3000"
- `nginx` to show certificate messages

### Step 4.6: Run Database Migrations

```bash
docker compose exec app npm run db:migrate
```

### Step 4.7: Test with Staging Certificate

1. Open `https://chat.yourdomain.com` in your browser
2. You'll see a certificate warning (expected with staging)
3. Click "Advanced" → "Proceed" to test
4. Verify the app loads and you can create an account

### Step 4.8: Switch to Production Certificate

```bash
# Edit .env
nano .env
# Change: CERTBOT_STAGING=0

# Remove staging certificates
docker compose exec nginx rm -rf /etc/letsencrypt/live/*
docker compose exec nginx rm -rf /etc/letsencrypt/archive/*
docker compose exec nginx rm -rf /etc/letsencrypt/renewal/*

# Restart nginx
docker compose restart nginx

# Check logs for successful certificate
docker compose logs -f nginx
```

---

## Part 5: Automatic Deployment with GitHub Actions

### Step 5.1: Create Deploy Key on Server

```bash
# Generate a deploy key
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""

# Show the public key (add to GitHub)
cat ~/.ssh/deploy_key.pub

# Show the private key (add to GitHub Secrets)
cat ~/.ssh/deploy_key
```

### Step 5.2: Add Deploy Key to GitHub Repository

1. Go to your fork: `https://github.com/YOUR_USERNAME/ocomms`
2. **Settings** → **Deploy keys** → **Add deploy key**
3. Title: `Hetzner Production Server`
4. Key: Paste the **public key** (`.pub`)
5. Check **Allow write access**
6. Click **Add key**

### Step 5.3: Add Server Secrets to GitHub

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add these repository secrets:

| Name | Value |
|------|-------|
| `DEPLOY_HOST` | Your server IP |
| `DEPLOY_USER` | `brett` (your username) |
| `DEPLOY_KEY` | The **private key** content (entire file including BEGIN/END lines) |
| `DEPLOY_PATH` | `/opt/ocomms` |

### Step 5.4: Create GitHub Actions Workflow

On your **local machine**, create the workflow file:

```bash
cd /path/to/your/local/ocomms
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [master]
  workflow_dispatch:  # Allow manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd ${{ secrets.DEPLOY_PATH }}

            # Pull latest changes
            git fetch origin master
            git reset --hard origin/master

            # Rebuild and restart containers
            docker compose pull
            docker compose build --no-cache app worker
            docker compose up -d

            # Run migrations
            docker compose exec -T app npm run db:migrate

            # Clean up old images
            docker image prune -f

            # Show status
            docker compose ps
```

Commit and push:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add automatic deployment workflow"
git push origin master
```

### Step 5.5: Authorize Server to Pull from GitHub

On the **server**:

```bash
cd /opt/ocomms

# Configure git to use deploy key for this repo
git config core.sshCommand "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no"

# Change remote to SSH (if using HTTPS)
git remote set-url origin git@github.com:ram-shortage/ocomms.git

# Test pull works
git fetch origin
```

### Step 5.6: Test Automatic Deployment

1. Make a small change locally (e.g., edit README)
2. Commit and push to master
3. Go to **GitHub** → **Actions** tab
4. Watch the deployment run
5. Verify the change appears on your server

---

## Part 6: Post-Deployment

### Step 6.1: Create Your Admin Account

1. Go to `https://chat.yourdomain.com`
2. Click **Sign Up**
3. Create your account
4. Create your first workspace

### Step 6.2: Set Up Automated Backups

```bash
# Create backup directory
mkdir -p /opt/ocomms/backups

# Create backup script
cat > /opt/ocomms/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/ocomms/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
docker compose -f /opt/ocomms/docker-compose.yml exec -T db pg_dump -U postgres ocomms > "$BACKUP_DIR/ocomms-$TIMESTAMP.sql"
# Keep only last 7 days
find "$BACKUP_DIR" -name "ocomms-*.sql" -mtime +7 -delete
echo "Backup completed: ocomms-$TIMESTAMP.sql"
EOF

chmod +x /opt/ocomms/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/ocomms/backup.sh") | crontab -

# Verify crontab
crontab -l
```

### Step 6.3: Test Backup

```bash
# Run manual backup
/opt/ocomms/backup.sh

# Verify backup exists
ls -la /opt/ocomms/backups/
```

---

## Quick Reference

### Common Commands

```bash
cd /opt/ocomms

# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart all services
docker compose restart

# Restart specific service
docker compose restart app
docker compose restart worker

# View status
docker compose ps

# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f app
docker compose logs -f worker
docker compose logs -f nginx

# View last 100 lines
docker compose logs --tail=100 app

# Run database migrations
docker compose exec app npm run db:migrate

# Access database CLI
docker compose exec db psql -U postgres -d ocomms

# Manual backup
/opt/ocomms/backup.sh

# Manual update (if not using GitHub Actions)
git pull origin master
docker compose build --no-cache app worker
docker compose up -d
docker compose exec app npm run db:migrate
```

### File Locations

| Path | Description |
|------|-------------|
| `/opt/ocomms` | Application root |
| `/opt/ocomms/.env` | Environment configuration |
| `/opt/ocomms/backups` | Database backups |
| `/opt/ocomms/public/uploads` | User uploads (files, emoji) |
| `~/.ssh/deploy_key` | GitHub deploy key |

### Ports

| Port | Service | Purpose |
|------|---------|---------|
| 22 | SSH | Server administration |
| 80 | nginx | HTTP (redirects to HTTPS) |
| 443 | nginx | HTTPS (main application) |
| 3000 | app | Next.js (internal) |
| 5432 | db | PostgreSQL (internal) |
| 6379 | redis | Redis (internal) |

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs app

# Restart all containers
docker compose down && docker compose up -d

# Check container status
docker compose ps
```

### Database Connection Error

```bash
# Check database is running
docker compose ps db

# Check database logs
docker compose logs db

# Test database connection
docker compose exec db pg_isready
```

### SSL Certificate Issues

```bash
# Check nginx logs
docker compose logs nginx

# Verify certificate status
docker compose exec nginx ls -la /etc/letsencrypt/live/

# Force certificate renewal
docker compose exec nginx certbot renew --force-renewal

# Make sure CERTBOT_STAGING=0 for production
grep CERTBOT_STAGING .env
```

### WebSocket Connection Failures

```bash
# Check nginx WebSocket configuration
docker compose exec nginx cat /etc/nginx/conf.d/default.conf | grep -A5 "location /socket.io"

# Restart nginx
docker compose restart nginx
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Remove unused Docker resources
docker system prune -a

# Check backup size
du -sh /opt/ocomms/backups/
```

### SSH Connection Refused

If you're locked out:

1. Go to Hetzner Cloud Console
2. Click on your server → **Rescue** tab
3. Enable rescue mode
4. Reboot and fix SSH config via rescue console

### GitHub Actions Deployment Fails

```bash
# On server, test git pull manually
cd /opt/ocomms
git fetch origin
git status

# Check deploy key permissions
ls -la ~/.ssh/deploy_key

# Test SSH to GitHub
ssh -i ~/.ssh/deploy_key -T git@github.com
```

---

## Security Checklist

- [ ] SSH password authentication disabled
- [ ] Root login disabled
- [ ] Firewall enabled (only ports 22, 80, 443)
- [ ] Strong database password set
- [ ] Unique auth secrets generated
- [ ] Production SSL certificate (CERTBOT_STAGING=0)
- [ ] Automated backups configured
- [ ] Deploy key has minimal permissions

---

## Support

- **Issues:** [GitHub Issues](https://github.com/ram-shortage/ocomms/issues)
- **Documentation:** [DEPLOYMENT.md](../DEPLOYMENT.md)
- **Project Planning:** [.planning/PROJECT.md](../.planning/PROJECT.md)

---

*Last updated: 2026-01-21 (v0.5.0)*
