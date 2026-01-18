# Troubleshooting Guide

Common issues encountered when deploying and running OComms, with solutions.

## Table of Contents

- [Docker Issues](#docker-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Email Issues](#email-issues)

---

## Docker Issues

### Docker daemon not running

**Symptom:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

**Solution:**

- **macOS:** Open Docker Desktop from Applications (Spotlight: `Cmd+Space`, type "Docker")
- **Linux:** `sudo systemctl start docker`

Wait for Docker to fully start before running `docker-compose` commands.

---

## Database Issues

### "The model 'user' was not found in the schema object"

**Symptom:**
```
BetterAuthError: [# Drizzle Adapter]: The model "user" was not found in the schema object.
```

**Cause:** Database tables haven't been created. The application started but the schema hasn't been pushed to PostgreSQL.

**Solution:**

1. Expose the database port (if not already exposed):

   Edit `docker-compose.yml` and add ports to the `db` service:
   ```yaml
   db:
     image: postgres:16-alpine
     ports:
       - "5432:5432"  # Add this line
   ```

2. Restart the database container:
   ```bash
   docker-compose up -d db
   ```

3. Run database migrations from the host:
   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/ocomms" npm run db:push
   ```

4. Restart the app:
   ```bash
   docker-compose restart app
   ```

### Cannot connect to database from host

**Symptom:**
```
ECONNREFUSED 127.0.0.1:5432
```

**Cause:** The PostgreSQL port is not exposed to the host machine. By default, `docker-compose.yml` only exposes it within the Docker network.

**Solution:**

Add port mapping to the `db` service in `docker-compose.yml`:
```yaml
db:
  image: postgres:16-alpine
  ports:
    - "5432:5432"
```

Then restart: `docker-compose up -d db`

### Database connection works in container but not from host

**Symptom:** `docker-compose exec db psql -U postgres -d ocomms` works, but local tools can't connect.

**Cause:** Port not exposed to host.

**Solution:** Same as above - add `ports: - "5432:5432"` to db service.

---

## Authentication Issues

### Signup fails silently

**Symptom:** Clicking "Sign Up" shows an error or nothing happens.

**Possible Causes:**

1. **Database tables don't exist** - See ["The model 'user' was not found"](#the-model-user-was-not-found-in-the-schema-object) above

2. **Check app logs:**
   ```bash
   docker-compose logs app --tail 50
   ```

### Stuck on "Verify your email" page

**Symptom:** After signup, redirected to email verification page but no email arrives and can't proceed.

**Cause:** `requireEmailVerification` is `true` but no SMTP server is configured.

**Solution:**

The app has been updated to only require email verification when SMTP is configured. If you're running an older version:

1. Edit `src/lib/auth.ts`:
   ```typescript
   emailAndPassword: {
     enabled: true,
     requireEmailVerification: !!process.env.SMTP_HOST, // Only require if SMTP configured
     minPasswordLength: 8,
   },
   ```

2. Rebuild and restart:
   ```bash
   docker-compose up -d --build app
   ```

**Alternative - Manual verification:**

If you need to manually verify a user in the database:
```bash
docker-compose exec db psql -U postgres -d ocomms -c \
  "UPDATE \"user\" SET \"emailVerified\" = true WHERE email = 'user@example.com';"
```

---

## Email Issues

### SMTP warnings in logs

**Symptom:**
```
The "SMTP_HOST" variable is not set. Defaulting to a blank string.
```

**Cause:** SMTP environment variables not configured. This is a warning, not an error.

**Impact:**
- Email verification emails won't be sent
- Workspace invitation emails won't be sent

**Solution (if you need email):**

Add SMTP configuration to your `.env` file:
```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
```

Then restart: `docker-compose up -d`

**Solution (if you don't need email):**

The warnings can be ignored. With the latest code, email verification is automatically disabled when SMTP isn't configured.

---

## Quick Diagnostic Commands

### Check all container status
```bash
docker-compose ps
```

### View app logs
```bash
docker-compose logs app --tail 100
```

### View all logs
```bash
docker-compose logs --tail 50
```

### Test database connection
```bash
docker-compose exec db psql -U postgres -d ocomms -c "SELECT 1"
```

### Check if tables exist
```bash
docker-compose exec db psql -U postgres -d ocomms -c "\dt"
```

### Restart all services
```bash
docker-compose restart
```

### Full rebuild
```bash
docker-compose down
docker-compose up -d --build
```

### Reset everything (WARNING: deletes all data)
```bash
docker-compose down -v  # -v removes volumes
docker-compose up -d --build
# Then run migrations again
```

---

## Getting Help

If you encounter an issue not covered here:

1. Check the app logs: `docker-compose logs app --tail 100`
2. Check all service status: `docker-compose ps`
3. Open an issue at: https://github.com/ram-shortage/ocomms/issues

Include:
- The error message
- Relevant log output
- Steps to reproduce
- Your environment (OS, Docker version)
