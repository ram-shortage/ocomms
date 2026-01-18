import * as fs from "fs";
import * as path from "path";

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
function ensureLogsDir(): void {
  const logsDir = getLogsDir();
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
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
 */
export function auditLog(data: AuditEventData): void {
  try {
    const event: AuditEvent = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    ensureLogsDir();

    const logPath = path.join(getLogsDir(), getLogFilename());
    const line = JSON.stringify(event) + "\n";

    // Append synchronously for atomic single-line writes
    fs.appendFileSync(logPath, line);
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

  if (!fs.existsSync(logsDir)) {
    console.log("Audit log cleanup: No logs directory found");
    return 0;
  }

  const files = fs.readdirSync(logsDir);
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
        fs.unlinkSync(filePath);
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
