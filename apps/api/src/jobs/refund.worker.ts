import { Worker } from "bullmq";
import IORedis from "ioredis";

import { env } from "../config/env.config";
import { sqlClient } from "../database/db";

import { REFUND_QUEUE, type RefundJobData } from "./refund.queue";

import {
  processRefundJob,
  processRefundReconciliationJob,
} from "./refund.processor";

// Chỉ cho phép chạy sandbox với database và Redis test.
const dbName = decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1));

const redisDb = new URL(env.REDIS_URL).pathname || "/0";

if (
  env.NODE_ENV !== "test" ||
  dbName !== "tickethub_w04_test" ||
  redisDb !== "/15" ||
  process.env.ENABLE_VNPAY_REFUND_SEND !== "true"
) {
  throw new Error(
    "Refund sending disabled: isolated sandbox environment required",
  );
}

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const worker = new Worker<RefundJobData>(
  REFUND_QUEUE,

  async (job) => {
    if (job.name === "send-refund") {
      return processRefundJob(job.data.refundId);
    }
    if (job.name === "reconcile-refund") {
      return processRefundReconciliationJob(job.data.refundId);
    }
    throw new Error("Unsupported refund job");
  },

  {
    connection,
    concurrency: 1,
  },
);

worker.on("completed", (job, result) => {
  console.log("[Refund Worker] Completed:", job.id, result);
});

worker.on("failed", (job, error) => {
  console.error("[Refund Worker] Failed:", job?.id, error.message);
});

async function shutdown() {
  await worker.close();
  await connection.quit();
  await sqlClient.end();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
