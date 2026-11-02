import { and, asc, eq, isNull } from "drizzle-orm";
import { RefundStatus } from "@tickethub/shared";

import { db } from "../database/db";
import { refunds } from "../database/schema";
import {
  enqueueRefund,
  enqueueRefundReconciliation,
  refundQueue,
} from "./refund.queue";

// Cho phep mock queue khi viet test.
interface QueueAdapter {
  getJobState(jobId: string): Promise<string>;
  getJob(jobId: string): Promise<
    | {
        retry(state: "failed"): Promise<void>;
      }
    | undefined
  >;
}

interface DispatchOptions {
  queue?: QueueAdapter;
  enqueue?: (refundId: string) => Promise<unknown>;
}

export type DispatchResult =
  | "ENQUEUED"
  | "RECOVERED_FAILED_JOB"
  | "ALREADY_QUEUED"
  | "SKIPPED_DB"
  | "NEEDS_ATTENTION";

// Chi chon refund chua co dau vet gui VNPay.
function eligibleRefund() {
  return and(
    eq(refunds.status, RefundStatus.PENDING),
    eq(refunds.needsReconciliation, false),
    eq(refunds.retryCount, 0),
    isNull(refunds.providerRequestId),
    isNull(refunds.lastAttemptAt),
  );
}

export async function dispatchRefundById(
  refundId: string,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const queue = options.queue ?? refundQueue;
  const enqueue = options.enqueue ?? enqueueRefund;

  const [candidate] = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(and(eq(refunds.id, refundId), eligibleRefund()))
    .limit(1);

  if (!candidate) {
    return "SKIPPED_DB";
  }

  const jobId = `refund_${refundId}`;
  const state = await queue.getJobState(jobId);

  // Job chua ton tai: tao lai tu PostgreSQL.
  if (state === "unknown") {
    await enqueue(refundId);
    return "ENQUEUED";
  }

  // BullMQ attempts are exhausted: manual review; never unlimited retry.
  if (state === "failed") return "NEEDS_ATTENTION";

  // Job COMPLETED nhung Refund PENDING:
  // co bat thuong, khong tu dong xoa job.
  if (state === "completed") {
    return "NEEDS_ATTENTION";
  }

  // waiting, active, delayed, waiting-children...
  return "ALREADY_QUEUED";
}

export async function dispatchPendingRefunds(batchSize = 50) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("Invalid dispatcher batch size");
  }

  const candidates = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(eligibleRefund())
    .orderBy(asc(refunds.createdAt), asc(refunds.id))
    .limit(batchSize);

  const summary = {
    scanned: candidates.length,
    enqueued: 0,
    recovered: 0,
    alreadyQueued: 0,
    skipped: 0,
    needsAttention: 0,
    errors: 0,
  };

  for (const candidate of candidates) {
    try {
      const result = await dispatchRefundById(candidate.id);

      switch (result) {
        case "ENQUEUED":
          summary.enqueued++;
          break;
        case "RECOVERED_FAILED_JOB":
          summary.recovered++;
          break;
        case "ALREADY_QUEUED":
          summary.alreadyQueued++;
          break;
        case "SKIPPED_DB":
          summary.skipped++;
          break;
        case "NEEDS_ATTENTION":
          summary.needsAttention++;
          console.warn("[Refund Dispatcher] Manual attention:", candidate.id);
          break;
      }
    } catch (error) {
      summary.errors++;

      console.error(
        "[Refund Dispatcher] Dispatch failed:",
        candidate.id,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return summary;
}

export async function dispatchRefundReconciliations(batchSize = 50) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("Invalid dispatcher batch size");
  }
  const candidates = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(
      and(
        eq(refunds.status, RefundStatus.PROCESSING),
        eq(refunds.needsReconciliation, true),
      ),
    )
    .orderBy(asc(refunds.updatedAt), asc(refunds.id))
    .limit(batchSize);

  const summary = {
    scanned: candidates.length,
    enqueued: 0,
    active: 0,
    attention: 0,
    errors: 0,
  };
  for (const item of candidates) {
    try {
      const jobId = `refund_reconcile_${item.id}`;
      const state = await refundQueue.getJobState(jobId);
      if (state === "unknown") {
        await enqueueRefundReconciliation(item.id);
        summary.enqueued++;
      } else if (state === "failed" || state === "completed") {
        // Unknown refund result remains blocked. Operator must reconcile
        // with provider; never recycle the send-refund job automatically.
        summary.attention++;
        console.warn("[Refund Reconcile] manual review:", item.id, state);
      } else {
        summary.active++;
      }
    } catch (error) {
      summary.errors++;
      console.error(
        "[Refund Reconcile] enqueue failed:",
        item.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return summary;
}
