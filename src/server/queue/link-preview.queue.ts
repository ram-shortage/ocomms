import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface LinkPreviewJobData {
  messageId: string;
  url: string;
  position: number; // Order in message (0-indexed)
}

export const linkPreviewQueue = new Queue<LinkPreviewJobData>(
  "link-previews",
  {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 100 },
    },
  }
);
