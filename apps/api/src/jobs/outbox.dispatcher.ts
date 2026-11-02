import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { OutboxStatus } from "@tickethub/shared";
import { env } from "../config/env.config";
import { db, sqlClient } from "../database/db";
import { outbox } from "../database/schema";

import {
  emailQueue,
  enqueueRegistrationEmail,
  enqueueReviewEmail,
  enqueueOrderPaidEmail,
} from "./email.queue";

import {
  REVIEW_EVENT_TYPES,
  UserRegisteredPayloadSchema,
  OrderPaidPayloadSchema,
  parseReviewPayload,
} from "./email.types";

import type { ReviewEventType } from "./email.types";

// Các chế độ thực thi
const enqueueTest = process.argv.includes("--enqueue-test");
const enqueueLive = process.argv.includes("--enqueue");
const enqueueEmailTest = process.argv.includes("--enqueue-email-test");

const enqueueReviewTest = process.argv.includes("--enqueue-review-test");

const dryRun =
  !enqueueTest && !enqueueLive && !enqueueEmailTest && !enqueueReviewTest;

const modes = [enqueueTest, enqueueLive, enqueueEmailTest, enqueueReviewTest];

if (modes.filter(Boolean).length > 1) {
  throw new Error("Only one enqueue mode is allowed");
}

// Giới hạn một Outbox khi kiểm thử Review
const idArgs = process.argv.filter((arg) => arg.startsWith("--outbox-id="));

if (idArgs.length > 1) {
  throw new Error("Only one outbox ID is allowed");
}

const targetOutboxId = idArgs[0]?.slice("--outbox-id=".length);
const MAX_ENQUEUE_RETRIES = 5;
async function main() {
  const testEmail = process.env.TEST_EMAIL_TO?.trim().toLowerCase();

  // 1. Bảo vệ chế độ kiểm thử Email Review
  if (enqueueReviewTest) {
    const databaseName = new URL(env.DATABASE_URL).pathname.slice(1);

    const redisDatabase = new URL(env.REDIS_URL).pathname;

    if (process.env.ENABLE_REVIEW_EMAIL_TEST !== "true") {
      throw new Error("Review email test is disabled");
    }

    if (!databaseName.endsWith("_test")) {
      throw new Error("Review test requires a dedicated _test database");
    }

    if (redisDatabase !== "/15") {
      throw new Error("Review test requires Redis database 15");
    }

    if (process.env.EMAIL_WORKER_MODE !== "live-test") {
      throw new Error("Review test requires live-test worker mode");
    }

    if (!testEmail) {
      throw new Error("TEST_EMAIL_TO is required");
    }

    if (
      !targetOutboxId ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(targetOutboxId)
    ) {
      throw new Error("Review test requires --outbox-id=<UUID>");
    }
  }

  // 2. Giữ cơ chế an toàn từ tuần 1
  if (enqueueEmailTest) {
    if (process.env.ENABLE_TEST_EMAIL_DISPATCH !== "true") {
      throw new Error("Test email dispatch is disabled");
    }

    if (!testEmail) {
      throw new Error("TEST_EMAIL_TO is required");
    }

    if (process.env.EMAIL_WORKER_MODE !== "live-test") {
      throw new Error("Worker must use live-test mode");
    }

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl || new URL(redisUrl).hostname !== "email-test-redis") {
      throw new Error("Test dispatch must use isolated Redis");
    }
  }

  if (enqueueLive && process.env.ENABLE_REAL_EMAIL_DISPATCH !== "true") {
    throw new Error("Real email dispatch is disabled");
  }

  const mode = enqueueReviewTest
    ? "REVIEW EMAIL TEST"
    : enqueueEmailTest
      ? "EMAIL LIVE TEST"
      : enqueueTest
        ? "TEST ENQUEUE"
        : enqueueLive
          ? "LIVE ENQUEUE"
          : "DRY RUN";

  console.log(`[Dispatcher] Mode: ${mode}`);

  // 3. Lấy Outbox chưa xử lý
  const events = await db
    .select({
      id: outbox.id,
      eventType: outbox.eventType,
      payload: outbox.payload,
      retryCount: outbox.retryCount,
    })
    .from(outbox)
    .where(
      and(
        eq(outbox.status, OutboxStatus.PENDING),

        enqueueReviewTest
          ? inArray(outbox.eventType, [...REVIEW_EVENT_TYPES])
          : inArray(outbox.eventType, [
              "USER_REGISTERED",
              "ORDER_PAID",
              ...REVIEW_EVENT_TYPES,
            ]),

        lte(outbox.nextRetryAt, new Date()),

        enqueueReviewTest ? eq(outbox.id, targetOutboxId!) : undefined,

        enqueueEmailTest
          ? sql`lower(${outbox.payload} ->> 'email') = ${testEmail}`
          : undefined,
      ),
    )
    .orderBy(asc(outbox.createdAt))
    .limit(enqueueReviewTest ? 1 : 10);

  console.log(`[Dispatcher] Found ${events.length} events`);

  let failed = 0;

  // 4. Xử lý từng Outbox
  for (const event of events) {
    try {
      const isRegistration = event.eventType === "USER_REGISTERED";
      const isOrderPaid = event.eventType === "ORDER_PAID";

      const isReview = (REVIEW_EVENT_TYPES as readonly string[]).includes(
        event.eventType,
      );

      if (!isRegistration && !isReview && !isOrderPaid) {
        throw new Error("Unsupported event type");
      }

      const registrationPayload = isRegistration
        ? UserRegisteredPayloadSchema.parse(event.payload)
        : null;

      const reviewPayload = isReview
        ? parseReviewPayload(event.eventType as ReviewEventType, event.payload)
        : null;

      const orderPaidPayload = isOrderPaid
        ? OrderPaidPayloadSchema.parse(event.payload)
        : null;

      // Chế độ đọc: không cập nhật dữ liệu
      if (dryRun) {
        console.log(`[Dispatcher] Valid: ${event.eventType} / ${event.id}`);
        continue;
      }

      // Chỉ cho phép đúng người nhận khi kiểm thử Review
      if (enqueueReviewTest) {
        if (!reviewPayload || reviewPayload.email.toLowerCase() !== testEmail) {
          console.log(`[Dispatcher] Skipped recipient: ${event.id}`);
          continue;
        }
      } else if (enqueueEmailTest) {
        if (
          !registrationPayload ||
          registrationPayload.email.toLowerCase() !== testEmail
        ) {
          continue;
        }
      } else if (enqueueTest) {
        if (
          !registrationPayload ||
          registrationPayload.email !== "outbox-smoke@example.invalid" ||
          registrationPayload.verificationToken !== "fake-test-token"
        ) {
          continue;
        }
      }

      // 5. Kiểm tra Job trùng trong Redis
      const jobId = `outbox_${event.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      if (existingJob) {
        console.warn(`[Dispatcher] Existing job ${jobId}`);
        console.warn("[Dispatcher] Manual reconciliation required");
        continue;
      }

      // 6. Claim Outbox nguyên tử
      const [claimed] = await db
        .update(outbox)
        .set({
          status: OutboxStatus.PROCESSING,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(outbox.id, event.id),
            eq(outbox.status, OutboxStatus.PENDING),
            lte(outbox.nextRetryAt, new Date()),
          ),
        )
        .returning({ id: outbox.id });

      if (!claimed) {
        console.log(`[Dispatcher] Already claimed: ${event.id}`);
        continue;
      }

      try {
        // 7. Đưa Job vào BullMQ theo đúng loại sự kiện
        const job = isReview
          ? await enqueueReviewEmail(
              event.id,
              event.eventType as ReviewEventType,
              reviewPayload!,
            )
          : isOrderPaid
            ? await enqueueOrderPaidEmail(event.id, orderPaidPayload!)
            : await enqueueRegistrationEmail(event.id, registrationPayload!);

        console.log(`[Dispatcher] Enqueued: ${job.id}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        // Chỉ trả lại PENDING khi enqueue thất bại

        const nextRetry = event.retryCount + 1;
        const giveUp = nextRetry >= MAX_ENQUEUE_RETRIES;
        await db
          .update(outbox)
          .set({
            status: giveUp ? OutboxStatus.FAILED : OutboxStatus.PENDING,
            retryCount: nextRetry,
            nextRetryAt: new Date(Date.now() + 30_000 * 2 ** event.retryCount),
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(outbox.id, event.id),
              eq(outbox.status, OutboxStatus.PROCESSING),
            ),
          );

        throw error;
      }
    } catch (error) {
      failed++;

      console.error(
        `[Dispatcher] Failed ${event.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("[Dispatcher] Finished");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error("[Dispatcher] Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await emailQueue.close();
    await sqlClient.end();
  });
