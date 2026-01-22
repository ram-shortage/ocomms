import { appendFile, mkdir, readFile } from "fs/promises";
import { existsSync, readdirSync, unlinkSync } from "fs";
import * as path from "path";
import { computeEntryHash } from "./audit-integrity";

/**
 * Audit event types for security logging
 */
export enum AuditEventType {
  AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_PASSWORD_RESET = "AUTH_PASSWORD_RESET",
  ADMIN_UNLOCK_USER = "ADMIN_UNLOCK_USER",
  ADMIN_EXPORT_DATA = "ADMIN_EXPORT_DATA",
  AUTHZ_FAILURE = "AUTHZ_FAILURE",
}

/**
 * Structure of an audit event
 */
export interface AuditEvent {
  timestamp: string; // ISO 8601
  eventType: AuditEventType;
  userId?: string; // User performing action (null for failed logins)
  targetId?: string; // Target of action (e.g., unlocked user)
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>; // Event-specific context
  // SEC2-07: Hash chain for tamper detection
  previousHash?: string; // Hash of previous entry (empty for first entry)
  hash?: string; // HMAC-SHA256 hash of this entry
}

/**
 * Data for creating an audit event (without timestamp)
 */
export type AuditEventData = Omit<AuditEvent, "timestamp">;

/**
 * Get logs directory path
 */
function getLogsDir(): string {
  return path.join(process.cwd(), "logs");
}

/**
 * Get log filename for current date
 */
function getLogFilename(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${date}.jsonl`;
}

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  const logsDir = getLogsDir();
  if (!existsSync(logsDir)) {
    await mkdir(logsDir, { recursive: true });
  }
}

/**
 * Get the hash of the last entry in a log file
 * SEC2-07: Used to link entries in hash chain
 */
async function getLastEntryHash(logPath: string): Promise<string> {
  try {
    if (!existsSync(logPath)) return "";
    const content = await readFile(logPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((l) => l);
    if (lines.length === 0) return "";
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    return lastEntry.hash || "";
  } catch {
    // If file read fails or parse fails, start fresh chain
    return "";
  }
}

/**
 * Extract client IP from request headers
 */
export function getClientIP(
  request: Request | Headers | undefined
): string | undefined {
  if (!request) return undefined;
  const headers = request instanceof Request ? request.headers : request;

  // Check x-forwarded-for first (common in proxied environments)
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated, first one is the client
    return forwarded.split(",")[0].trim();
  }

  // Check x-real-ip (alternative proxy header)
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return undefined;
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(
  request: Request | Headers | undefined
): string | undefined {
  if (!request) return undefined;
  const headers = request instanceof Request ? request.headers : request;
  return headers.get("user-agent") ?? undefined;
}

/**
 * Log an audit event
 *
 * Fire-and-forget pattern - does not block on write
 * Failures are logged to console but don't throw
 *
 * SEC2-07: Includes HMAC hash chain for tamper detection
 */
export async function auditLog(data: AuditEventData): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    await ensureLogsDir();
    const logPath = path.join(getLogsDir(), getLogFilename());

    // SEC2-07: Get previous entry hash for chain linking
    const previousHash = await getLastEntryHash(logPath);

    // Compute hash for this entry
    const hash = computeEntryHash({ ...data, timestamp }, previousHash);

    const event: AuditEvent = {
      ...data,
      timestamp,
      previousHash: previousHash || undefined,
      hash: hash || undefined,
    };

    const line = JSON.stringify(event) + "\n";

    // SECFIX-08: Async append - non-blocking
    await appendFile(logPath, line);
  } catch (error) {
    // Fire-and-forget - log errors but don't throw
    console.error("Audit log write failed:", error);
  }
}

/**
 * Clean up old audit log files
 *
 * Deletes log files older than retentionDays.
 * Returns count of deleted files.
 *
 * Note: Logs cleanup activity to console (not to audit log to avoid recursion)
 *
 * @param retentionDays Number of days to retain logs (default: 90)
 * @returns Number of files deleted
 */
export function cleanupOldLogs(retentionDays: number = 90): number {
  const logsDir = getLogsDir();

  if (!existsSync(logsDir)) {
    console.log("Audit log cleanup: No logs directory found");
    return 0;
  }

  const files = readdirSync(logsDir);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffDateOnly = new Date(cutoffDate.toISOString().split("T")[0] + "T00:00:00Z");

  let deletedCount = 0;

  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;

    // Parse date from filename (YYYY-MM-DD.jsonl)
    const dateStr = file.replace(".jsonl", "");
    const fileDate = new Date(dateStr + "T00:00:00Z");

    // Skip if date is invalid
    if (isNaN(fileDate.getTime())) {
      console.warn(`Audit log cleanup: Skipping invalid filename ${file}`);
      continue;
    }

    // Delete if older than retention period
    if (fileDate < cutoffDateOnly) {
      try {
        const filePath = path.join(logsDir, file);
        unlinkSync(filePath);
        deletedCount++;
        console.log(`Audit log cleanup: Deleted ${file}`);
      } catch (error) {
        console.error(`Audit log cleanup: Failed to delete ${file}:`, error);
      }
    }
  }

  console.log(`Audit log cleanup: Deleted ${deletedCount} files older than ${retentionDays} days`);
  return deletedCount;
}
