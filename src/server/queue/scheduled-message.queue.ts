import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface ScheduledMessageJobData {
  scheduledMessageId: string;
}

export const scheduledMessageQueue = new Queue<ScheduledMessageJobData>(
  "scheduled-messages",
  {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }
);
