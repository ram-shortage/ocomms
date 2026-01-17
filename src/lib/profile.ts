import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getProfile(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
}

export async function upsertProfile(
  userId: string,
  data: { displayName?: string; bio?: string; avatarPath?: string }
) {
  const existing = await getProfile(userId);

  if (existing) {
    return db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
  }

  return db.insert(profiles).values({ userId, ...data }).returning();
}
