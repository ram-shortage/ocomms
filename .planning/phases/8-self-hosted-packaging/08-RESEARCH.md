# Phase 8: Self-Hosted Packaging - Research

**Researched:** 2026-01-18
**Domain:** Docker deployment, database backup/restore, data export
**Confidence:** HIGH

## Summary

Self-hosted packaging for OComms requires containerizing a Next.js application with a custom Socket.IO server, PostgreSQL database, and optional Redis. The key challenge is combining Next.js standalone output mode with a custom server - this requires bundling the server separately with esbuild since standalone mode does not trace custom server files.

For backup/restore, PostgreSQL's native pg_dump/pg_restore tools are the standard approach, with the custom format (-Fc) providing compression and selective restore capabilities. Data export for GDPR compliance should use JSON for complex relational data (preserving relationships) and optionally CSV for spreadsheet compatibility.

**Primary recommendation:** Use multi-stage Docker builds with esbuild-bundled custom server, pg_dump custom format for backups, and JSON for data export. Include Nginx as reverse proxy for TLS termination and WebSocket upgrade handling.

## Standard Stack

The established tools for self-hosted Docker deployment:

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Docker | 24+ | Container runtime | Industry standard, supported everywhere |
| Docker Compose | 2.30+ | Multi-container orchestration | Single-command deployment, health checks |
| Nginx | 1.25+ | Reverse proxy, TLS | WebSocket support, production hardening |
| esbuild | 0.24+ | Bundle custom server | Fastest bundler, handles node externals |
| pg_dump | 16+ | PostgreSQL backup | Native, reliable, supports custom format |
| pg_restore | 16+ | PostgreSQL restore | Native, handles custom format |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| wait-for-it.sh | Service startup ordering | Database init before app start |
| Trivy | Image vulnerability scanning | CI/CD security checks |
| alpine | Minimal base image | Production containers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nginx | Traefik | Traefik has auto-TLS but Nginx is more familiar |
| esbuild | tsup/webpack | esbuild is fastest, others more configurable |
| pg_dump | Barman | Barman for enterprise PITR, pg_dump for simple backups |

**Installation:**
```bash
# No npm packages - Docker handles all dependencies
# esbuild for server bundling
npm install -D esbuild
```

## Architecture Patterns

### Recommended Container Structure
```
ocomms/
├── docker-compose.yml          # Production orchestration
├── docker-compose.dev.yml      # Development overrides
├── Dockerfile                  # Multi-stage app build
├── nginx/
│   ├── nginx.conf              # Main config
│   └── conf.d/
│       └── default.conf        # Site config with WebSocket
├── scripts/
│   ├── build-server.ts         # esbuild bundler script
│   ├── backup.sh               # PostgreSQL backup script
│   ├── restore.sh              # PostgreSQL restore script
│   ├── export-data.ts          # Data export script
│   └── migrate.ts              # Database migration script
└── backups/                    # Mounted backup volume
```

### Pattern 1: Multi-Stage Docker Build with Custom Server
**What:** Separate build stage from runtime, bundle custom server with esbuild
**When to use:** Always for this project (custom Socket.IO server)
**Example:**
```dockerfile
# Source: https://hmos.dev/en/nextjs-docker-standalone-and-custom-server
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx esbuild src/server/index.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/index.js --external:next

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist-server ./
COPY --from=builder /app/node_modules/next ./node_modules/next
USER nextjs
EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
CMD ["node", "index.js"]
```

### Pattern 2: Health Check with Database Dependency
**What:** Use Compose health checks instead of wait-for-it scripts
**When to use:** Always for production Docker Compose
**Example:**
```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  app:
    depends_on:
      db:
        condition: service_healthy
```

### Pattern 3: Nginx WebSocket Proxy
**What:** Configure Nginx to handle WebSocket upgrade for Socket.IO
**When to use:** Always when using Nginx in front of Socket.IO
**Example:**
```nginx
# Source: https://socket.io/docs/v3/reverse-proxy/
location /socket.io/ {
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Pattern 4: Programmatic Database Migration
**What:** Run migrations at container startup via Drizzle's migrate()
**When to use:** Production deployments
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/migrations
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations complete");
await sql.end();
```

### Anti-Patterns to Avoid
- **Using npm/yarn to start in Docker:** Never use `npm start` in CMD - use `node` directly to handle SIGTERM correctly
- **Running as root:** Always use non-root user in production containers
- **Hardcoding secrets in Compose:** Use .env files or Docker secrets, never inline
- **Missing health checks:** Without health checks, dependent services may start before DB is ready
- **Using :latest tag:** Pin specific versions for reproducible builds

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS termination | Custom HTTPS in Node | Nginx/Traefik | Proven, secure, auto-renewal support |
| Database backups | Custom export scripts | pg_dump | Handles all edge cases, consistent snapshots |
| Service startup order | Sleep loops | Docker Compose health checks | Built-in, declarative, reliable |
| Secret management | .env in image | Docker secrets or mounted files | .env in images leaks to registries |
| Log rotation | Custom log handling | Docker logging driver | Handles rotation, prevents disk fill |
| Process management | PM2 in container | Docker restart policies | One process per container principle |

**Key insight:** Docker ecosystem has mature solutions for deployment concerns. Focus on application code, not infrastructure reinvention.

## Common Pitfalls

### Pitfall 1: Standalone Mode + Custom Server Conflict
**What goes wrong:** Next.js standalone output doesn't include custom server files
**Why it happens:** Standalone traces only Next.js dependencies, not custom entry points
**How to avoid:** Bundle server separately with esbuild, copy node_modules/next manually
**Warning signs:** "MODULE_NOT_FOUND: next" errors at runtime

### Pitfall 2: WebSocket Upgrades Through Nginx
**What goes wrong:** Socket.IO connections fail or fall back to polling
**Why it happens:** Missing proxy_http_version 1.1 and Upgrade headers
**How to avoid:** Use exact Socket.IO nginx config from official docs
**Warning signs:** "WebSocket connection failed" in browser console

### Pitfall 3: Database Not Ready at App Start
**What goes wrong:** App crashes on startup with connection refused
**Why it happens:** App container starts before PostgreSQL accepts connections
**How to avoid:** Use depends_on with condition: service_healthy
**Warning signs:** "ECONNREFUSED" errors in app logs during startup

### Pitfall 4: Backup During Active Writes
**What goes wrong:** Inconsistent backup state
**Why it happens:** pg_dump takes time, writes continue during dump
**How to avoid:** pg_dump handles this with MVCC snapshots, but avoid during peak
**Warning signs:** Foreign key violations on restore

### Pitfall 5: Running as Root in Container
**What goes wrong:** Security vulnerability, potential host compromise
**Why it happens:** Default Docker behavior runs as root
**How to avoid:** Create non-root user, use USER directive
**Warning signs:** `whoami` in container returns "root"

### Pitfall 6: Docker Image Bloat
**What goes wrong:** 1GB+ images, slow deployments
**Why it happens:** Including dev dependencies, not using multi-stage builds
**How to avoid:** Multi-stage build, copy only production artifacts
**Warning signs:** Image size > 500MB for Node app

### Pitfall 7: Secrets in Docker History
**What goes wrong:** Build args with secrets visible in image layers
**Why it happens:** Using ARG for secrets during build
**How to avoid:** Use runtime environment variables or mounted secrets
**Warning signs:** `docker history` shows secret values

## Code Examples

Verified patterns for self-hosted deployment:

### Complete docker-compose.yml
```yaml
# Production docker-compose for single-command deployment
version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/certs:/etc/nginx/certs:ro  # For HTTPS
    depends_on:
      app:
        condition: service_healthy
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/ocomms
      - REDIS_URL=redis://redis:6379
      - BETTER_AUTH_SECRET=${AUTH_SECRET}
      - BETTER_AUTH_URL=${APP_URL}
      - NEXT_PUBLIC_APP_URL=${APP_URL}
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
      - ./backups:/backups
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
```

### PostgreSQL Backup Script
```bash
#!/bin/bash
# scripts/backup.sh - PostgreSQL backup with pg_dump custom format
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ocomms_${TIMESTAMP}.dump"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Create backup with custom format (compressed, selective restore)
pg_dump -Fc -U postgres -d ocomms > "${BACKUP_FILE}"

# Verify backup
pg_restore --list "${BACKUP_FILE}" > /dev/null

echo "Backup created: ${BACKUP_FILE}"
echo "Size: $(du -h "${BACKUP_FILE}" | cut -f1)"

# Clean old backups
find "${BACKUP_DIR}" -name "ocomms_*.dump" -mtime +${RETENTION_DAYS} -delete
echo "Cleaned backups older than ${RETENTION_DAYS} days"
```

### PostgreSQL Restore Script
```bash
#!/bin/bash
# scripts/restore.sh - PostgreSQL restore from backup
set -euo pipefail

BACKUP_FILE="${1:?Usage: restore.sh <backup_file>}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will drop and recreate the ocomms database!"
read -p "Continue? (y/N) " confirm
[[ "${confirm}" =~ ^[Yy]$ ]] || exit 0

# Drop connections and recreate database
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'ocomms' AND pid <> pg_backend_pid();"
psql -U postgres -c "DROP DATABASE IF EXISTS ocomms;"
psql -U postgres -c "CREATE DATABASE ocomms;"

# Restore
pg_restore -U postgres -d ocomms --clean --if-exists "${BACKUP_FILE}"

echo "Restore complete from: ${BACKUP_FILE}"
```

### Data Export Script (JSON format)
```typescript
// scripts/export-data.ts - GDPR-compliant data export
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

interface ExportOptions {
  organizationId?: string;
  userId?: string;  // For individual user exports (GDPR)
  outputDir: string;
}

async function exportData(options: ExportOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportDir = path.join(options.outputDir, `export_${timestamp}`);
  fs.mkdirSync(exportDir, { recursive: true });

  // Export organization data
  if (options.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: (orgs, { eq }) => eq(orgs.id, options.organizationId!),
      with: {
        members: { with: { user: true } },
      },
    });

    const channels = await db.query.channels.findMany({
      where: (ch, { eq }) => eq(ch.organizationId, options.organizationId!),
      with: {
        members: true,
        messages: true,
      },
    });

    fs.writeFileSync(
      path.join(exportDir, "organization.json"),
      JSON.stringify({ organization: org, channels }, null, 2)
    );
  }

  // Export user-specific data (GDPR Article 20)
  if (options.userId) {
    const userData = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, options.userId!),
      with: {
        profile: true,
        messages: true,
        channelMemberships: true,
      },
    });

    fs.writeFileSync(
      path.join(exportDir, "user_data.json"),
      JSON.stringify(userData, null, 2)
    );
  }

  // Create manifest
  fs.writeFileSync(
    path.join(exportDir, "manifest.json"),
    JSON.stringify({
      exportDate: new Date().toISOString(),
      format: "JSON",
      version: "1.0",
      organizationId: options.organizationId,
      userId: options.userId,
    }, null, 2)
  );

  console.log(`Export complete: ${exportDir}`);
  await sql.end();
}
```

### esbuild Server Bundler Script
```typescript
// scripts/build-server.ts
import { build } from "esbuild";

await build({
  entryPoints: ["src/server/index.ts"],
  outfile: "dist-server/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  minify: true,
  sourcemap: true,
  external: [
    "next",         // Must be copied separately
    "sharp",        // Native addon
    "lightningcss", // Native addon
  ],
});

console.log("Server bundled to dist-server/index.js");
```

### Nginx Configuration for Socket.IO
```nginx
# nginx/conf.d/default.conf
upstream app {
    server app:3000;
}

server {
    listen 80;
    server_name _;

    # Redirect HTTP to HTTPS in production
    # return 301 https://$host$request_uri;

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
        proxy_read_timeout 86400;  # Long-lived connections
    }
}
```

### Health Check Endpoint
```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
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
| docker-compose v2 | Compose v2 (docker compose) | 2023 | Integrated into Docker CLI |
| wait-for-it scripts | Health checks with conditions | Compose 2.0 | Declarative, more reliable |
| npm start in Docker | Direct node command | Best practice | Proper signal handling |
| Root user containers | Non-root by default | Security focus 2024 | Required for security |
| .env in images | Docker secrets / runtime env | Security focus | Prevents credential leaks |
| Single-stage builds | Multi-stage builds | Standard since 2020 | 70-80% smaller images |

**Deprecated/outdated:**
- `docker-compose` (hyphenated) command: Use `docker compose` (space)
- Version 2 Compose files: Use Compose Specification (no version key)
- `links` in Compose: Use networks instead
- `--link` flag: Deprecated, use user-defined networks

## Open Questions

Things that couldn't be fully resolved:

1. **TLS Certificate Management**
   - What we know: Nginx handles TLS termination well
   - What's unclear: Whether to include Certbot in compose or expect external certs
   - Recommendation: Provide both options - manual cert mount and Certbot sidecar

2. **Horizontal Scaling Configuration**
   - What we know: Redis adapter enables multi-instance Socket.IO
   - What's unclear: Specific Compose config for replicas with Swarm
   - Recommendation: Document single-instance first, scaling guide separately

3. **Backup Scheduling**
   - What we know: cron on host or separate container both work
   - What's unclear: Best practice for self-hosted (no external scheduler)
   - Recommendation: Use simple cron on host, document in setup guide

## Sources

### Primary (HIGH confidence)
- [Next.js Official Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying) - Docker deployment overview
- [Socket.IO Reverse Proxy Docs](https://socket.io/docs/v3/reverse-proxy/) - Nginx WebSocket configuration
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) - Programmatic migration API
- [Docker Compose Health Checks](https://docs.docker.com/compose/how-tos/startup-order/) - Service dependency handling
- [Docker Build Best Practices](https://docs.docker.com/build/building/best-practices/) - Multi-stage, non-root users

### Secondary (MEDIUM confidence)
- [Next.js Docker + Custom Server Guide](https://hmos.dev/en/nextjs-docker-standalone-and-custom-server) - esbuild bundling pattern
- [PostgreSQL Backup in Docker](https://simplebackups.com/blog/docker-postgres-backup-restore-guide-with-examples/) - pg_dump patterns
- [Docker Redis Deployment](https://eastondev.com/blog/en/posts/dev/20251217-docker-redis-deployment/) - Persistence configuration

### Tertiary (LOW confidence)
- [GDPR Data Portability](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-data-portability/) - JSON export format recommendations
- [Docker Secrets Best Practices](https://phase.dev/blog/docker-compose-secrets/) - Security considerations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Docker, Compose, Nginx are industry standards
- Architecture: HIGH - Patterns verified against official docs
- Backup/Restore: HIGH - pg_dump is PostgreSQL's standard tool
- Data Export: MEDIUM - JSON format standard but implementation details vary
- Custom Server Bundle: MEDIUM - esbuild approach verified but edge cases possible

**Research date:** 2026-01-18
**Valid until:** 2026-04-18 (3 months - Docker ecosystem stable)
