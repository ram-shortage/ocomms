"use server";

import { db } from "@/db";
import { channels, channelMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createChannel(formData: {
  organizationId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const slug = slugify(formData.name);

  // Create channel and add creator as admin member in transaction
  const [channel] = await db.transaction(async (tx) => {
    const [newChannel] = await tx.insert(channels).values({
      organizationId: formData.organizationId,
      name: formData.name,
      slug,
      description: formData.description || null,
      isPrivate: formData.isPrivate || false,
      createdBy: session.user.id,
    }).returning();

    await tx.insert(channelMembers).values({
      channelId: newChannel.id,
      userId: session.user.id,
      role: "admin",
    });

    return [newChannel];
  });

  revalidatePath(`/`);
  return channel;
}

export async function getChannels(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get all public channels + private channels user is member of
  const allChannels = await db.query.channels.findMany({
    where: eq(channels.organizationId, organizationId),
    with: {
      members: true,
    },
  });

  return allChannels.filter(
    (ch) => !ch.isPrivate || ch.members.some((m) => m.userId === session.user.id)
  );
}

export async function getUserChannels(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const userMemberships = await db.query.channelMembers.findMany({
    where: eq(channelMembers.userId, session.user.id),
    with: {
      channel: true,
    },
  });

  return userMemberships
    .filter((m) => m.channel.organizationId === organizationId)
    .map((m) => m.channel);
}

export async function joinChannel(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Check channel exists and is public
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) throw new Error("Channel not found");
  if (channel.isPrivate) throw new Error("Cannot join private channel directly");

  await db.insert(channelMembers).values({
    channelId,
    userId: session.user.id,
    role: "member",
  }).onConflictDoNothing();

  revalidatePath(`/`);
  return { success: true };
}
