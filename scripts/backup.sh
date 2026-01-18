#!/bin/bash
# PostgreSQL backup script for ocomms
# Usage: Run inside db container: docker compose exec db /backups/backup.sh
# Make executable: chmod +x scripts/backup.sh
set -euo pipefail

# Configuration with defaults
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ocomms_${TIMESTAMP}.dump"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-ocomms}"

echo "=== OComms Database Backup ==="
echo "Database: ${PGDATABASE}"
echo "User: ${PGUSER}"
echo "Backup directory: ${BACKUP_DIR}"
echo ""

# Pre-flight checks
echo "Running pre-flight checks..."

# Verify backup directory exists
if [[ ! -d "${BACKUP_DIR}" ]]; then
    echo "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"
fi

# Verify pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "Error: pg_dump not found. Please run this inside the db container."
    exit 1
fi

echo "Pre-flight checks passed."
echo ""

# Backup execution
echo "Creating backup..."
pg_dump -Fc -U "${PGUSER}" -d "${PGDATABASE}" > "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}"
echo ""

# Backup verification
echo "Verifying backup integrity..."
if pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1; then
    echo "Backup verification passed."
else
    echo "Error: Backup verification failed!"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Print backup details
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo ""
echo "Backup details:"
echo "  File: ${BACKUP_FILE}"
echo "  Size: ${BACKUP_SIZE}"
echo ""

# Retention cleanup
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
CLEANED_COUNT=$(find "${BACKUP_DIR}" -name "ocomms_*.dump" -mtime +"${RETENTION_DAYS}" -print -delete 2>/dev/null | wc -l | tr -d ' ')
echo "Removed ${CLEANED_COUNT} old backup(s)."
echo ""

# Exit message
echo "=== Backup Complete ==="
echo "Backup saved to: ${BACKUP_FILE}"
