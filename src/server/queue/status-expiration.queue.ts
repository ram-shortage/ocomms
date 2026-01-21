import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface StatusExpirationJobData {
  userId: string;
}

export const statusExpirationQueue = new Queue<StatusExpirationJobData>(
  "status-expiration",
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
