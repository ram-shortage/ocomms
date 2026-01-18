# Phase 10: Transport Security - Research

**Researched:** 2026-01-18
**Domain:** TLS/SSL certificates, HTTPS enforcement, database connection encryption
**Confidence:** HIGH

## Summary

Transport security for OComms requires three components: (1) HTTPS termination with automatic Let's Encrypt certificate management, (2) HTTP to HTTPS redirection with HSTS headers, and (3) SSL encryption for PostgreSQL database connections. The existing infrastructure already includes nginx as a reverse proxy with WebSocket support and Docker Compose orchestration, making this a configuration enhancement rather than architectural change.

For HTTPS, two approaches are viable: **docker-nginx-certbot** (single container combining nginx + certbot) or **nginx-proxy + acme-companion** (separate containers). Given the project's single-domain self-hosted nature, docker-nginx-certbot is simpler and sufficient. For PostgreSQL SSL, postgres.js (already in use) supports SSL via connection options; since both app and database run in the same Docker network, self-signed certificates are acceptable with `sslmode=require`.

**Primary recommendation:** Use docker-nginx-certbot for automatic HTTPS with Let's Encrypt, configure HSTS headers, and enable PostgreSQL SSL with self-signed certificates generated at container startup.

## Standard Stack

The established tools for transport security:

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| docker-nginx-certbot | latest | Combined nginx + certbot | Automatic cert renewal, single container |
| Let's Encrypt | - | Free TLS certificates | Industry standard, automatic renewal |
| postgres.js | 3.4+ | PostgreSQL client with SSL | Already in use, native SSL support |
| OpenSSL | 3.x | Certificate generation | Standard for self-signed certs |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| mkcert | Local development certs | Dev environment HTTPS testing |
| certbot CLI | Manual cert testing | Debugging certificate issues |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docker-nginx-certbot | nginx-proxy + acme-companion | More flexible for multi-site, but adds complexity |
| docker-nginx-certbot | Caddy | Simpler config, but different from existing nginx setup |
| Self-signed DB certs | Managed CA | More secure but unnecessary for internal Docker network |

## Architecture Patterns

### Recommended Project Structure
```
ocomms/
├── docker-compose.yml          # Updated with SSL volumes
├── nginx/
│   └── conf.d/
│       └── default.conf        # Updated for HTTPS + HSTS
├── certs/
│   └── postgres/               # Self-signed DB certs (generated)
│       ├── server.crt
│       └── server.key
└── scripts/
    └── generate-db-certs.sh    # PostgreSQL cert generation
```

### Pattern 1: docker-nginx-certbot for Automatic HTTPS
**What:** Single container that combines nginx with certbot for automatic certificate management
**When to use:** Single-domain deployments, self-hosted applications
**Example:**
```yaml
# docker-compose.yml
services:
  nginx:
    image: jonasal/nginx-certbot:5-alpine
    ports:
      - "80:80"
      - "443:443"
    environment:
      - CERTBOT_EMAIL=admin@example.com
      - STAGING=0  # Set to 1 for testing
    volumes:
      - ./nginx/conf.d:/etc/nginx/user_conf.d:ro
      - letsencrypt:/etc/letsencrypt
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped

volumes:
  letsencrypt:
```
Source: https://github.com/JonasAlfredsson/docker-nginx-certbot

### Pattern 2: nginx HTTPS Configuration with HSTS
**What:** nginx server block for HTTPS with security headers
**When to use:** All HTTPS-enabled deployments
**Example:**
```nginx
# nginx/conf.d/default.conf
upstream app {
    server app:3000;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name _;

    # Let's Encrypt ACME challenge (handled by certbot)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl;
    server_name example.com;

    # Managed by certbot
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Modern TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket handling
    location /socket.io/ {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```
Source: https://blog.nginx.org/blog/http-strict-transport-security-hsts-and-nginx

### Pattern 3: PostgreSQL SSL with Self-Signed Certificates
**What:** Enable SSL on PostgreSQL container with generated certificates
**When to use:** Database connections within Docker network
**Example:**
```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ocomms
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./certs/postgres:/var/lib/postgresql/certs:ro
    command: >
      -c ssl=on
      -c ssl_cert_file=/var/lib/postgresql/certs/server.crt
      -c ssl_key_file=/var/lib/postgresql/certs/server.key
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
```
Source: https://sliplane.io/blog/setup-tls-for-postgresql-in-docker

### Pattern 4: postgres.js SSL Connection
**What:** Configure postgres.js to require SSL connections
**When to use:** Application database connections
**Example:**
```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// SSL configuration for postgres.js
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production'
    ? 'require'  // Requires SSL but doesn't verify cert (OK for internal Docker network)
    : false,     // No SSL in development
});

export const db = drizzle(client, {
  schema,
  casing: "snake_case",
});
```
Source: https://github.com/porsager/postgres

### Anti-Patterns to Avoid
- **ssl: { rejectUnauthorized: false } in production:** Disables certificate verification entirely, vulnerable to MITM
- **HSTS on HTTP responses:** Only add Strict-Transport-Security header to HTTPS responses
- **Short max-age for HSTS:** Use at least 1 year (31536000 seconds) for proper protection
- **Missing SSL redirect:** All HTTP traffic must redirect to HTTPS before any content is served
- **Database SSL certs in git:** Generate at deployment time, never commit private keys

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Certificate renewal | Custom renewal scripts | docker-nginx-certbot | Handles renewal, nginx reload automatically |
| Certificate generation | Manual openssl | certbot/Let's Encrypt | Free, trusted, automatic |
| TLS configuration | Custom cipher suites | Mozilla SSL Config Generator | Security-tested, up-to-date |
| HTTPS redirect | Application-level redirect | nginx 301 redirect | Faster, before app processes request |
| Health check over SSL | Custom cert verification | Let's Encrypt staging | Test with staging before production |

**Key insight:** Let's Encrypt + nginx solves HTTPS completely. Focus on configuration, not implementation.

## Common Pitfalls

### Pitfall 1: Let's Encrypt Rate Limits
**What goes wrong:** Certificate issuance blocked for up to a week
**Why it happens:** Too many failed attempts or duplicate certificate requests
**How to avoid:** Always use `STAGING=1` during initial setup and testing
**Warning signs:** "too many certificates already issued" errors from certbot

### Pitfall 2: Port 80 Blocked During ACME Challenge
**What goes wrong:** Let's Encrypt cannot verify domain ownership
**Why it happens:** Firewall blocks port 80, or nginx redirects before challenge
**How to avoid:** Ensure `/.well-known/acme-challenge/` is served on port 80 without redirect
**Warning signs:** "unauthorized" or "connection refused" in certbot logs

### Pitfall 3: PostgreSQL Certificate Permissions
**What goes wrong:** PostgreSQL refuses to start with "could not load private key file"
**Why it happens:** Key file has wrong permissions (must be 600, owned by postgres user)
**How to avoid:** Set `chmod 600` and `chown 70:70` (postgres user in alpine) on key file
**Warning signs:** PostgreSQL container fails health check immediately after start

### Pitfall 4: Missing X-Forwarded-Proto Header
**What goes wrong:** Application doesn't know it's behind HTTPS, generates HTTP URLs
**Why it happens:** nginx not forwarding protocol information to app
**How to avoid:** Always include `proxy_set_header X-Forwarded-Proto $scheme;`
**Warning signs:** Mixed content warnings, redirect loops, OAuth failures

### Pitfall 5: HSTS Too Early
**What goes wrong:** Site becomes inaccessible if HTTPS breaks
**Why it happens:** Browser caches HSTS policy, won't allow HTTP fallback
**How to avoid:** Start with short max-age (1 hour), increase gradually after confirming stability
**Warning signs:** "NET::ERR_CERT_AUTHORITY_INVALID" with no way to bypass

### Pitfall 6: First-Time Certificate Chicken-and-Egg
**What goes wrong:** nginx won't start without certs, certbot needs nginx running
**Why it happens:** nginx config references non-existent certificate files
**How to avoid:** docker-nginx-certbot handles this automatically with dummy certs
**Warning signs:** nginx exits immediately on first docker-compose up

## Code Examples

Verified patterns for transport security:

### Certificate Generation Script for PostgreSQL
```bash
#!/bin/bash
# scripts/generate-db-certs.sh
set -euo pipefail

CERT_DIR="${1:-./certs/postgres}"
mkdir -p "$CERT_DIR"

# Generate self-signed certificate for PostgreSQL
openssl req -new -x509 -days 365 -nodes \
  -subj "/CN=postgres" \
  -out "$CERT_DIR/server.crt" \
  -keyout "$CERT_DIR/server.key"

# Set permissions for PostgreSQL (uid 70 in postgres:alpine)
chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

# If running as root (e.g., in CI), set ownership
if [ "$(id -u)" = "0" ]; then
  chown 70:70 "$CERT_DIR/server.key"
fi

echo "PostgreSQL certificates generated in $CERT_DIR"
```

### Complete docker-compose.yml with SSL
```yaml
services:
  nginx:
    image: jonasal/nginx-certbot:5-alpine
    ports:
      - "80:80"
      - "443:443"
    environment:
      - CERTBOT_EMAIL=${CERTBOT_EMAIL}
      - STAGING=${CERTBOT_STAGING:-0}
    volumes:
      - ./nginx/conf.d:/etc/nginx/user_conf.d:ro
      - letsencrypt:/etc/letsencrypt
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/ocomms?sslmode=require
      - REDIS_URL=redis://redis:6379
      - BETTER_AUTH_SECRET=${AUTH_SECRET}
      - BETTER_AUTH_URL=${APP_URL}
      - NEXT_PUBLIC_APP_URL=${APP_URL}
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ocomms
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./certs/postgres:/var/lib/postgresql/certs:ro
    command: >
      -c ssl=on
      -c ssl_cert_file=/var/lib/postgresql/certs/server.crt
      -c ssl_key_file=/var/lib/postgresql/certs/server.key
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  letsencrypt:
```

### Updated .env.example
```bash
# Database
DATABASE_URL=postgresql://postgres:changeme@db:5432/ocomms?sslmode=require
DB_PASSWORD=changeme

# Auth
BETTER_AUTH_SECRET=generate-a-secret-here
AUTH_SECRET=generate-a-secret-here

# App URL (HTTPS in production)
APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
BETTER_AUTH_URL=https://your-domain.com

# Let's Encrypt
CERTBOT_EMAIL=admin@your-domain.com
CERTBOT_STAGING=0  # Set to 1 for testing

# SMTP (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# Redis
REDIS_URL=redis://redis:6379
```

### Database Connection with SSL Detection
```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;

// Determine SSL mode from connection string or environment
const useSSL = connectionString.includes('sslmode=') || process.env.NODE_ENV === 'production';

const client = postgres(connectionString, {
  // postgres.js accepts: false, true, 'require', 'prefer', or tls.connect options
  ssl: useSSL ? 'require' : false,
});

export const db = drizzle(client, {
  schema,
  casing: "snake_case",
});
```

### SSL Verification Test Endpoint
```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { db, sql } from "@/db";

export async function GET() {
  try {
    // Check database connectivity and SSL status
    const result = await db.execute(sql`SELECT ssl_is_used() as ssl_enabled`);
    const sslEnabled = result[0]?.ssl_enabled ?? false;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        ssl: sslEnabled,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: (error as Error).message },
      { status: 503 }
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual certbot cron | Containerized auto-renewal | 2020+ | No manual intervention needed |
| TLS 1.0/1.1 | TLS 1.2/1.3 only | 2020 | TLS 1.0/1.1 deprecated by browsers |
| RSA 2048 | ECDSA preferred | 2023 | Smaller, faster certificates |
| Custom cipher config | Mozilla SSL Config Generator | Ongoing | Always current best practices |
| HTTP challenge only | HTTP-01 + DNS-01 options | 2022 | Wildcard cert support |

**Deprecated/outdated:**
- TLS 1.0/1.1: No longer supported by modern browsers
- RC4, 3DES ciphers: Removed from recommended configs
- Manual certificate renewal: Replaced by automated renewal
- nginx without `ssl_prefer_server_ciphers off`: Modern approach lets client choose cipher

## Open Questions

Things that couldn't be fully resolved:

1. **Wildcard Certificate Need**
   - What we know: Single-domain cert is sufficient for current requirements
   - What's unclear: If future subdomains (api.example.com, ws.example.com) will be needed
   - Recommendation: Start with single-domain, add wildcard via DNS-01 challenge if needed later

2. **Redis TLS**
   - What we know: Redis supports TLS, but connections are internal to Docker network
   - What's unclear: Whether Redis TLS adds meaningful security for internal traffic
   - Recommendation: Skip Redis TLS initially, add if compliance requires it

3. **Certificate Storage in Docker Volumes**
   - What we know: Let's Encrypt certs stored in named volume work well
   - What's unclear: Backup/restore strategy for letsencrypt volume
   - Recommendation: Include letsencrypt volume in backup strategy, or accept re-issuance

## Sources

### Primary (HIGH confidence)
- [docker-nginx-certbot GitHub](https://github.com/JonasAlfredsson/docker-nginx-certbot) - Container setup, environment variables
- [nginx-proxy/acme-companion GitHub](https://github.com/nginx-proxy/acme-companion) - Alternative approach documentation
- [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) - How automatic HTTPS works (alternative reference)
- [NGINX HSTS Guide](https://blog.nginx.org/blog/http-strict-transport-security-hsts-and-nginx) - Security header configuration
- [PostgreSQL SSL Docker Guide](https://sliplane.io/blog/setup-tls-for-postgresql-in-docker) - Database SSL setup

### Secondary (MEDIUM confidence)
- [node-postgres SSL](https://node-postgres.com/features/ssl) - SSL configuration options (node-postgres, not postgres.js but similar)
- [letsencrypt-docker-compose](https://github.com/eugene-khyst/letsencrypt-docker-compose) - Alternative certbot setup
- [PostgreSQL SSL Documentation](https://www.postgresql.org/docs/current/ssl-tcp.html) - Official PostgreSQL SSL reference

### Tertiary (LOW confidence)
- WebSearch results for postgres.js SSL - Limited official documentation, behavior inferred from similar libraries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - docker-nginx-certbot and Let's Encrypt are well-documented
- Architecture: HIGH - nginx HTTPS patterns are standard and verified
- PostgreSQL SSL: MEDIUM - postgres.js SSL options less documented than node-postgres
- HSTS: HIGH - Well-documented nginx directive with clear best practices

**Research date:** 2026-01-18
**Valid until:** 2026-04-18 (3 months - TLS ecosystem stable)
