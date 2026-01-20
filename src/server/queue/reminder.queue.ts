import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface ReminderJobData {
  reminderId: string;
}

export const reminderQueue = new Queue<ReminderJobData>(
  "reminders",
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
