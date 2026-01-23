import { db } from "@/db";
import { userStorage } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_QUOTA = 1073741824; // 1GB in bytes
const WARNING_THRESHOLD = 0.8; // 80%

export type QuotaCheckResult = {
  allowed: boolean;
  currentUsage: number;
  quota: number;
  percentUsed: number;
  showWarning: boolean;
};

export async function getOrCreateUserStorage(userId: string) {
  let storage = await db.query.userStorage.findFirst({
    where: eq(userStorage.userId, userId),
  });

  if (!storage) {
    const [created] = await db
      .insert(userStorage)
      .values({ userId, usedBytes: 0, quotaBytes: DEFAULT_QUOTA })
      .returning();
    storage = created;
  }

  return storage;
}

export async function checkQuota(
  userId: string,
  uploadSizeBytes: number
): Promise<QuotaCheckResult> {
  const storage = await getOrCreateUserStorage(userId);
  const projectedUsage = storage.usedBytes + uploadSizeBytes;
  const percentUsed = projectedUsage / storage.quotaBytes;

  return {
    allowed: projectedUsage <= storage.quotaBytes,
    currentUsage: storage.usedBytes,
    quota: storage.quotaBytes,
    percentUsed: Math.min(percentUsed, 1),
    showWarning: percentUsed >= WARNING_THRESHOLD && percentUsed < 1,
  };
}

export async function updateUsage(
  userId: string,
  deltaSizeBytes: number
): Promise<void> {
  const storage = await getOrCreateUserStorage(userId);
  await db
    .update(userStorage)
    .set({
      usedBytes: Math.max(0, storage.usedBytes + deltaSizeBytes),
      updatedAt: new Date(),
    })
    .where(eq(userStorage.userId, userId));
}

export async function getUserStorage(userId: string) {
  return getOrCreateUserStorage(userId);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
