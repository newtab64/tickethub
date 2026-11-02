import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { OutboxStatus } from "@tickethub/shared";
import { decideRecovery } from "./recovery-decision";
import { db, sqlClient } from "../database/db";
import { outbox } from "../database/schema";
import { emailQueue } from "./email.queue";
import { REVIEW_EVENT_TYPES } from "./email.types";
const STALE_AFTER_MS = 5 * 60 * 1000;
const markFailed = process.argv.includes("--mark-failed");
const idArgs = process.argv.filter((arg) => arg.startsWith("--outbox-id="));

if (idArgs.length > 1) {
  throw new Error("Only one --outbox-id is allowed.");
}

const targetId = idArgs[0]?.slice("--outbox-id=".length);

if (
  targetId &&
  !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(targetId)
) {
  throw new Error("Invalid Outbox UUID.");
}
async function main() {
  if (markFailed && process.env.ENABLE_OUTBOX_RECOVERY_WRITE !== "true") {
    throw new Error(
      "Recovery write is disabled. " +
        "ENABLE_OUTBOX_RECOVERY_WRITE must be true.",
    );
  }
  if (markFailed) {
    if (!targetId) {
      throw new Error("--mark-failed requires --outbox-id=<UUID>");
    }

    if (process.env.OUTBOX_RECOVERY_APPROVED_ID !== targetId) {
      throw new Error("Explicit approval for this Outbox is required.");
    }
  }

  console.log("[Recovery] Checking stuck Outbox events...");
  console.log(`[Recovery] Mode: ${markFailed ? "MARK FAILED" : "READ ONLY"}`);

  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const events = await db
    .select({
      id: outbox.id,
      eventType: outbox.eventType,
      status: outbox.status,
      retryCount: outbox.retryCount,
      updatedAt: outbox.updatedAt,
    })
    .from(outbox)
    .where(
      and(
        eq(outbox.status, OutboxStatus.PROCESSING),
        inArray(outbox.eventType, [
          "USER_REGISTERED",
          "ORDER_PAID",
          ...REVIEW_EVENT_TYPES,
        ]),
        lte(outbox.updatedAt, cutoff),
        targetId ? eq(outbox.id, targetId) : undefined,
      ),
    )
    .orderBy(asc(outbox.updatedAt))
    .limit(20);

  console.log(`[Recovery] Found ${events.length} stale events`);

  let markedFailed = 0;
  let requiresReview = 0;

  for (const event of events) {
    const jobId = `outbox_${event.id}`;

    try {
      const job = await emailQueue.getJob(jobId);
      if (job && job.data?.outboxId !== event.id) {
        console.warn(`[Recovery] Job/Outbox mismatch: ${event.id}`);

        requiresReview++;
        continue;
      }
      const jobState = job ? await job.getState() : "missing";

      const attemptsMade = job?.attemptsMade ?? 0;
      const maxAttempts = Math.max(1, job?.opts.attempts ?? 1);
      const decision = decideRecovery(jobState, attemptsMade, maxAttempts);

      console.log(`[Recovery] Decision: ${decision}`);
      console.log({
        outboxId: event.id,
        outboxStatus: event.status,
        retryCount: event.retryCount,
        jobState,
        attemptsMade,
        maxAttempts,
        updatedAt: event.updatedAt,
      });

      // Job vẫn nằm trong hàng đợi hoặc đang retry.
      if (decision === "WAIT") {
        console.log(`[Recovery] Job ${jobId} is still managed by BullMQ`);
        continue;
      }

      const exhausted = decision === "MARK_FAILED";

      if (exhausted) {
        if (!markFailed) {
          console.warn(
            `[Recovery] ${jobId} exhausted retries. ` +
              "Use approved recovery procedure.",
          );
          requiresReview++;
          continue;
        }

        if (!job || (await job.getState()) !== "failed") {
          console.warn(`[Recovery] Job state changed: ${jobId}`);

          requiresReview++;
          continue;
        }

        const [updated] = await db
          .update(outbox)
          .set({
            status: OutboxStatus.FAILED,
            errorMessage:
              `BullMQ job exhausted ${attemptsMade} attempts. ` +
              "Manual reconciliation required.",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(outbox.id, event.id),
              eq(outbox.status, OutboxStatus.PROCESSING),
              lte(outbox.updatedAt, cutoff),
              eq(outbox.updatedAt, event.updatedAt),
            ),
          )
          .returning({
            id: outbox.id,
          });

        if (updated) {
          markedFailed++;
          console.log(`[Recovery] Outbox marked FAILED: ${updated.id}`);
        } else {
          console.warn(`[Recovery] Outbox changed concurrently: ${event.id}`);
          requiresReview++;
        }

        continue;
      }

      // Không biết chắc email đã gửi hay chưa:
      // Không tự động đưa Outbox về PENDING.
      console.warn(
        `[Recovery] Manual review required: ${jobId}, ` +
          `jobState=${jobState}`,
      );

      requiresReview++;
    } catch (error) {
      requiresReview++;

      console.error(
        `[Recovery] Error inspecting ${event.id}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  console.log("[Recovery] Finished", {
    inspected: events.length,
    markedFailed,
    requiresReview,
  });

  if (requiresReview > 0) {
    console.warn("[Recovery] Some events require manual reconciliation.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("[Recovery] Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await emailQueue.close();
    await sqlClient.end();
  });
