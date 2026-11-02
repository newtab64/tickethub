import { Queue } from "bullmq";
import { env } from "../config/env.config";
import {
  MAX_RECONCILE_ATTEMPTS,
  MAX_REFUND_ATTEMPTS,
} from "./refund-retry-policy";

export const REFUND_QUEUE = "tickethub-refund";

export interface RefundJobData {
  refundId: string;
}

const redisUrl = new URL(env.REDIS_URL);

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  db: Number(redisUrl.pathname.slice(1) || 0),
  username: redisUrl.username
    ? decodeURIComponent(redisUrl.username)
    : undefined,
  password: redisUrl.password
    ? decodeURIComponent(redisUrl.password)
    : undefined,
  ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};

export const refundQueue = new Queue<RefundJobData>(REFUND_QUEUE, {
  connection,
  defaultJobOptions: {
    // Retries occur only when the processor THROWS before a confirmed send.
    // After any possible HTTP send, state is PROCESSING and is not sent again.
    attempts: MAX_REFUND_ATTEMPTS,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export async function enqueueRefund(refundId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(refundId)) {
    throw new Error("Invalid refund ID");
  }

  return refundQueue.add(
    "send-refund",
    { refundId },
    { jobId: `refund_${refundId}` },
  );
}

/** QueryDR may not prove an earlier refund was NOT performed.
 * Retry the READ with backoff; never retry the refund POST on an unknown result.
 */
export async function enqueueRefundReconciliation(refundId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(refundId)) {
    throw new Error("Invalid refund ID");
  }
  return refundQueue.add(
    "reconcile-refund",
    { refundId },
    {
      jobId: `refund_reconcile_${refundId}`,
      attempts: MAX_RECONCILE_ATTEMPTS,
      backoff: { type: "exponential", delay: 5 * 60 * 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    },
  );
}
