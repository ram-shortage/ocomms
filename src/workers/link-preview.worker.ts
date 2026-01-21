import { Worker } from "bullmq";
import { unfurl } from "unfurl.js";
import fetch from "node-fetch";
import {
  RequestFilteringHttpAgent,
  RequestFilteringHttpsAgent,
} from "request-filtering-agent";
import { db } from "@/db";
import { linkPreviews, messageLinkPreviews, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getQueueConnection } from "@/server/queue/connection";
import { getEmitter } from "@/server/queue/emitter";
import { isUrlSafe } from "@/lib/ssrf-protection";
import type { LinkPreviewJobData } from "@/server/queue/link-preview.queue";

const CACHE_TTL_HOURS = 24;

// Create filtering agents for SSRF protection (LINK-07)
const httpAgent = new RequestFilteringHttpAgent();
const httpsAgent = new RequestFilteringHttpsAgent();

/**
 * Custom fetch with SSRF protection via request-filtering-agent.
 * Blocks requests to private/internal IP addresses.
 */
async function safeFetch(url: string): Promise<Response> {
  const parsedUrl = new URL(url);
  const agent = parsedUrl.protocol === "https:" ? httpsAgent : httpAgent;

  const response = await fetch(url, {
    agent,
    timeout: 5000,
    follow: 3,
    headers: {
      Accept: "text/html, application/xhtml+xml",
      "User-Agent": "facebookexternalhit",
    },
  });

  // Convert node-fetch Response to something unfurl.js expects
  return response as unknown as Response;
}

/**
 * Fetch and cache a link preview.
 */
async function fetchAndCachePreview(
  messageId: string,
  url: string,
  position: number
): Promise<void> {
  // 1. Check URL safety (protocol, file extension)
  if (!isUrlSafe(url)) {
    console.log(`[LinkPreview] Skipping unsafe URL: ${url}`);
    return;
  }

  // 2. Check if message still exists
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    columns: { id: true, channelId: true, conversationId: true },
  });
  if (!message) {
    console.log(`[LinkPreview] Message ${messageId} not found, skipping`);
    return;
  }

  // 3. Check cache first
  const cached = await db.query.linkPreviews.findFirst({
    where: eq(linkPreviews.url, url),
  });

  if (cached && new Date(cached.expiresAt) > new Date()) {
    // Use cached preview, just link to message
    await linkToMessage(cached.id, messageId, position, message);
    return;
  }

  // 4. Fetch metadata with SSRF protection (request-filtering-agent)
  try {
    const metadata = await unfurl(url, {
      timeout: 5000,
      follow: 3,
      // Pass filtering fetch for SSRF protection (blocks private IPs after DNS resolution)
      fetch: safeFetch,
    });

    const previewData = {
      url,
      title: metadata.open_graph?.title || metadata.title || null,
      description:
        metadata.open_graph?.description || metadata.description || null,
      imageUrl: metadata.open_graph?.images?.[0]?.url || null,
      siteName: metadata.open_graph?.site_name || null,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000),
    };

    // 5. Upsert preview (update if exists, insert if not)
    let previewId: string;
    if (cached) {
      await db
        .update(linkPreviews)
        .set(previewData)
        .where(eq(linkPreviews.id, cached.id));
      previewId = cached.id;
    } else {
      const [inserted] = await db
        .insert(linkPreviews)
        .values(previewData)
        .returning({ id: linkPreviews.id });
      previewId = inserted.id;
    }

    // 6. Link to message and broadcast
    await linkToMessage(previewId, messageId, position, message);
  } catch (error) {
    // CONTEXT decision: Failed/timed out fetches silently fall back to plain hyperlink
    console.log(`[LinkPreview] Failed to fetch ${url}:`, error);
  }
}

/**
 * Link a preview to a message and broadcast the update.
 */
async function linkToMessage(
  previewId: string,
  messageId: string,
  position: number,
  message: { channelId: string | null; conversationId: string | null }
): Promise<void> {
  // Insert junction record (ignore if already exists)
  await db
    .insert(messageLinkPreviews)
    .values({ messageId, linkPreviewId: previewId, position })
    .onConflictDoNothing();

  // Fetch full preview for broadcast
  const preview = await db.query.linkPreviews.findFirst({
    where: eq(linkPreviews.id, previewId),
  });

  if (preview) {
    // Broadcast to room
    const emitter = getEmitter();
    const room = message.channelId
      ? `channel:${message.channelId}`
      : `dm:${message.conversationId}`;

    emitter.to(room).emit("linkPreview:ready", {
      messageId,
      previews: [
        {
          id: preview.id,
          url: preview.url,
          title: preview.title,
          description: preview.description,
          imageUrl: preview.imageUrl,
          siteName: preview.siteName,
        },
      ],
    });

    console.log(
      `[LinkPreview] Preview ready for ${preview.url} -> ${messageId}`
    );
  }
}

/**
 * Create and return the link preview worker.
 * Worker processes jobs from the link-previews queue.
 */
export function createLinkPreviewWorker(): Worker<LinkPreviewJobData> {
  return new Worker<LinkPreviewJobData>(
    "link-previews",
    async (job) => {
      console.log(
        `[LinkPreview] Processing job ${job.id} for ${job.data.url}`
      );
      await fetchAndCachePreview(
        job.data.messageId,
        job.data.url,
        job.data.position
      );
    },
    {
      connection: getQueueConnection(),
      concurrency: 10, // Higher concurrency for fetch-heavy work
    }
  );
}
