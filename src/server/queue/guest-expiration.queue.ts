import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface GuestExpirationJobData {
  memberId: string;
}

export const guestExpirationQueue = new Queue<GuestExpirationJobData>(
  "guest-expiration",
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
