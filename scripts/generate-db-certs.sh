#!/bin/bash
# Generate self-signed SSL certificates for PostgreSQL
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
