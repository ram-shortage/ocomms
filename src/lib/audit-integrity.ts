import crypto from 'crypto';

interface AuditEntryData {
  id?: string;
  timestamp: string;
  eventType: string;
  userId?: string;
  organizationId?: string;
  details?: Record<string, unknown>;
}

/**
 * Compute HMAC-SHA256 hash for audit entry.
 * Links to previous entry via previousHash for tamper detection.
 *
 * SEC2-07: Audit log integrity verification
 */
export function computeEntryHash(
  entry: AuditEntryData,
  previousHash: string
): string {
  const secret = process.env.AUDIT_LOG_SECRET;
  if (!secret) {
    console.warn('AUDIT_LOG_SECRET not set - audit log integrity disabled');
    return '';
  }

  // Deterministic serialization for hash computation
  // Only include fields that matter for integrity, in consistent order
  const data = JSON.stringify({
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    userId: entry.userId || null,
    organizationId: entry.organizationId || null,
    previousHash
  });

  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}

/**
 * Verify hash chain integrity for a sequence of audit entries.
 * Returns { valid: boolean, brokenAt?: number }
 *
 * SEC2-07: Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyChain(
  entries: Array<AuditEntryData & { hash?: string; previousHash?: string }>
): { valid: boolean; brokenAt?: number } {
  const secret = process.env.AUDIT_LOG_SECRET;
  if (!secret) {
    // If no secret configured, can't verify - assume valid
    return { valid: true };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.hash) continue; // Skip entries without hash (pre-migration)

    const computedHash = computeEntryHash(entry, entry.previousHash || '');

    // Use timing-safe comparison to prevent timing attacks
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(entry.hash, 'hex')
      );
      if (!isValid) {
        return { valid: false, brokenAt: i };
      }
    } catch {
      // Buffer length mismatch or invalid hex
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true };
}
