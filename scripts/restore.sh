#!/bin/bash
# PostgreSQL restore script for ocomms
# Usage: Run inside db container: docker compose exec db /backups/restore.sh /backups/ocomms_YYYYMMDD_HHMMSS.dump
# Make executable: chmod +x scripts/restore.sh
set -euo pipefail

# Usage validation
if [[ $# -lt 1 ]]; then
    echo "Usage: restore.sh <backup_file>"
    echo ""
    echo "Example: restore.sh /backups/ocomms_20260118_103045.dump"
    echo ""
    echo "Available backups:"
    ls -lh /backups/ocomms_*.dump 2>/dev/null || echo "  No backups found in /backups"
    exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Configuration with defaults
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-ocomms}"

echo "=== OComms Database Restore ==="
echo "Backup file: ${BACKUP_FILE}"
echo "Database: ${PGDATABASE}"
echo "User: ${PGUSER}"
echo ""

# Show backup details
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "Backup size: ${BACKUP_SIZE}"
echo ""

# Safety confirmation
echo "=========================================="
echo "WARNING: This is a DESTRUCTIVE operation!"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. Terminate all active connections to '${PGDATABASE}'"
echo "  2. DROP the '${PGDATABASE}' database if it exists"
echo "  3. CREATE a fresh '${PGDATABASE}' database"
echo "  4. RESTORE data from the backup file"
echo ""
echo "All current data in '${PGDATABASE}' will be PERMANENTLY LOST."
echo ""

read -p "Are you sure you want to continue? (y/N) " confirm
if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Starting restore process..."
echo ""

# Pre-restore preparation
echo "Step 1/4: Terminating existing connections..."
psql -U "${PGUSER}" -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${PGDATABASE}' AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true
echo "Done."

echo "Step 2/4: Dropping existing database..."
psql -U "${PGUSER}" -d postgres -c "DROP DATABASE IF EXISTS ${PGDATABASE};" > /dev/null
echo "Done."

echo "Step 3/4: Creating fresh database..."
psql -U "${PGUSER}" -d postgres -c "CREATE DATABASE ${PGDATABASE};" > /dev/null
echo "Done."

# Restore execution
echo "Step 4/4: Restoring from backup..."
# FIX: Properly capture and report pg_restore errors instead of hiding them
# pg_restore returns non-zero on warnings too, so we capture output and check for actual failures
RESTORE_OUTPUT=$(pg_restore -U "${PGUSER}" -d "${PGDATABASE}" --clean --if-exists --verbose "${BACKUP_FILE}" 2>&1) || RESTORE_EXIT_CODE=$?

# Check if restore actually failed (not just warnings)
# pg_restore returns 1 for warnings, but we need to check if data was restored
if [[ "${RESTORE_EXIT_CODE:-0}" -ne 0 ]]; then
    echo "pg_restore output:"
    echo "${RESTORE_OUTPUT}"
    echo ""
fi

# Verify restore succeeded by checking for tables
echo "Verifying restore..."
TABLE_COUNT=$(psql -U "${PGUSER}" -d "${PGDATABASE}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')

if [[ -z "${TABLE_COUNT}" ]] || [[ "${TABLE_COUNT}" -lt 1 ]]; then
    echo ""
    echo "=========================================="
    echo "ERROR: Restore verification FAILED!"
    echo "=========================================="
    echo ""
    echo "No tables found in database after restore."
    echo "The pg_restore output above may contain the cause."
    echo ""
    exit 1
fi

echo ""
echo "=== Restore Complete ==="
echo "Database '${PGDATABASE}' restored from: ${BACKUP_FILE}"
echo "Tables restored: ${TABLE_COUNT}"
echo ""
echo "Note: You may need to restart the application to reconnect to the database."
