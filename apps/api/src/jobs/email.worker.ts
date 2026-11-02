import { Worker, UnrecoverableError } from "bullmq";
import IORedis from "ioredis";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import { OrderStatus, OutboxStatus, TicketStatus } from "@tickethub/shared";

import { env } from "../config/env.config";
import { db, sqlClient } from "../database/db";
import { outbox, orders, users, tickets } from "../database/schema";

import {
  sendRegistrationEmail,
  sendReviewEmail,
  sendOrderPaidEmail,
} from "./email.sender";

import {
  EMAIL_QUEUE_NAME,
  REVIEW_EVENT_TYPES,
  UserRegisteredPayloadSchema,
  OrderPaidPayloadSchema,
  parseReviewPayload,
} from "./email.types";

import type { EmailJobData, ReviewEventType } from "./email.types";

// Kết nối Redis cho BullMQ
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const MODE = process.env.EMAIL_WORKER_MODE;
if (!MODE && env.NODE_ENV === "production") {
  throw new UnrecoverableError("EMAIL_WORKER_MODE must be set in production");
}
const WORKER_MODE = MODE ?? "mock";
if (!["mock", "live-test", "live"].includes(WORKER_MODE)) {
  throw new UnrecoverableError(`Unsupported mode: ${WORKER_MODE}`);
}

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,

  async (job) => {
    const { outboxId, eventType } = job.data;

    const isRegistration = eventType === "USER_REGISTERED";
    const isOrderPaid = eventType === "ORDER_PAID";

    // 1. Kiểm tra loại công việc
    if (isRegistration) {
      if (job.name !== "user-registered") {
        throw new UnrecoverableError("Invalid registration job");
      }
    } else if (isOrderPaid) {
      if (job.name !== "order-paid") {
        throw new UnrecoverableError("Invalid ORDER_PAID job");
      }
    } else {
      if (
        job.name !== "admin-review" ||
        !REVIEW_EVENT_TYPES.includes(eventType as ReviewEventType)
      ) {
        throw new UnrecoverableError(`Unsupported job: ${job.name}`);
      }
    }

    console.log(`[Email Worker] Processing: ${outboxId}`);

    // 2. Lấy Outbox từ PostgreSQL
    const [event] = await db
      .select({
        id: outbox.id,
        eventType: outbox.eventType,
        payload: outbox.payload,
        status: outbox.status,
      })
      .from(outbox)
      .where(eq(outbox.id, outboxId))
      .limit(1);

    if (!event || event.eventType !== eventType) {
      throw new UnrecoverableError("Matching Outbox event not found");
    }

    if (event.status === OutboxStatus.COMPLETED) {
      console.log("[Email Worker] Already completed");

      return { alreadyCompleted: true };
    }

    // 3. Kiểm tra payload
    const reviewType = eventType as ReviewEventType;

    const jobPayload = isRegistration
      ? UserRegisteredPayloadSchema.parse(job.data.payload)
      : isOrderPaid
        ? OrderPaidPayloadSchema.parse(job.data.payload)
        : parseReviewPayload(reviewType, job.data.payload);

    const storedPayload = isRegistration
      ? UserRegisteredPayloadSchema.parse(event.payload)
      : isOrderPaid
        ? OrderPaidPayloadSchema.parse(event.payload)
        : parseReviewPayload(reviewType, event.payload);

    // Không sử dụng dữ liệu Redis nếu khác PostgreSQL
    if (!isDeepStrictEqual(jobPayload, storedPayload)) {
      throw new UnrecoverableError("Job payload does not match Outbox");
    }

    // 4. Chống xử lý lại sự kiện hoàn thành

    if (event.status !== OutboxStatus.PROCESSING) {
      throw new UnrecoverableError(`Unexpected Outbox status: ${event.status}`);
    }

    // 5. Kiểm tra chế độ gửi email
    const mode = WORKER_MODE;

    if (mode === "mock") {
      console.log("[Email Worker] Mock only - no email sent");

      // Giữ Outbox PROCESSING, không giả mạo đã gửi.
      // Chỉ sử dụng mock trên môi trường test cô lập.
      return { simulated: true };
    }

    // ORDER_PAID Outbox stores only userId; fetch recipient from PostgreSQL.
    let recipientEmail: string;
    let ticketCodes: string[] = [];
    if (isOrderPaid) {
      const payload = OrderPaidPayloadSchema.parse(storedPayload);
      const [[order], [user], orderTickets] = await Promise.all([
        db
          .select({ userId: orders.userId, status: orders.status })
          .from(orders)
          .where(eq(orders.id, payload.orderId))
          .limit(1),
        db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, payload.userId))
          .limit(1),
        db
          .select({
            id: tickets.id,
            status: tickets.status,
            userId: tickets.userId,
            ticketCode: tickets.ticketCode,
          })
          .from(tickets)
          .where(eq(tickets.orderId, payload.orderId)),
      ]);
      if (
        !order ||
        !user ||
        order.userId !== payload.userId ||
        order.status !== OrderStatus.PAID ||
        orderTickets.length !== payload.ticketIds.length ||
        orderTickets.some(
          (t) =>
            (t.status !== TicketStatus.SOLD &&
              t.status !== TicketStatus.CHECKED_IN) ||
            t.userId !== payload.userId ||
            !payload.ticketIds.includes(t.id),
        )
      ) {
        throw new UnrecoverableError(
          "ORDER_PAID outbox does not match confirmed tickets",
        );
      }
      recipientEmail = user.email;
      ticketCodes = orderTickets.map((t) => t.ticketCode);
    } else {
      recipientEmail = (storedPayload as { email: string }).email;
    }

    if (mode === "live-test") {
      const testEmail = process.env.TEST_EMAIL_TO?.trim().toLowerCase();

      // Isolated W04 sandbox exception: redirect exactly ONE confirmed
      // ORDER_PAID email to the Resend account's permitted testing inbox.
      // The buyer's stored email, order, ticket and Outbox are NOT modified.
      const redirectThisOrderOnly =
        isOrderPaid &&
        env.NODE_ENV === "test" &&
        new URL(env.DATABASE_URL).pathname === "/tickethub_w04_test" &&
        new URL(env.REDIS_URL).pathname === "/15" &&
        process.env.ENABLE_ORDER_PAID_EMAIL_TEST === "true" &&
        process.env.TEST_ORDER_PAID_OUTBOX_ID ===
          "7a2df97c-7f7d-4540-a375-b46db47011b2" &&
        event.id === "7a2df97c-7f7d-4540-a375-b46db47011b2" &&
        OrderPaidPayloadSchema.parse(storedPayload).orderCode ===
          "ORD-20261101-6219CE" &&
        recipientEmail.trim().toLowerCase() === "baamntk@gmail.com" &&
        testEmail === "nguyentuankhoi2603@gmail.com";

      if (redirectThisOrderOnly) {
        console.log(
          `[Email Worker] TEST ONLY: redirect ORDER_PAID ${event.id} to TEST_EMAIL_TO`,
        );
        recipientEmail = testEmail!;
      }

      if (!testEmail || recipientEmail.toLowerCase() !== testEmail) {
        throw new UnrecoverableError("Recipient is not TEST_EMAIL_TO");
      }
    } else if (mode === "live") {
      if (process.env.ENABLE_REAL_EMAIL !== "true") {
        throw new UnrecoverableError("Real email sending is disabled");
      }
    } else {
      throw new UnrecoverableError(`Unsupported mode: ${mode}`);
    }

    // 6. Gửi email theo loại event
    let emailId: string;

    if (isRegistration) {
      emailId = await sendRegistrationEmail(
        event.id,
        UserRegisteredPayloadSchema.parse(storedPayload),
      );
    } else if (isOrderPaid) {
      emailId = await sendOrderPaidEmail(
        event.id,
        OrderPaidPayloadSchema.parse(storedPayload),
        recipientEmail,
        ticketCodes,
      );
    } else {
      emailId = await sendReviewEmail(
        event.id,
        reviewType,
        parseReviewPayload(reviewType, storedPayload),
      );
    }

    // 7. Cập nhật Outbox sau khi Resend chấp nhận
    const [updated] = await db
      .update(outbox)
      .set({
        status: OutboxStatus.COMPLETED,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outbox.id, event.id),
          eq(outbox.status, OutboxStatus.PROCESSING),
        ),
      )
      .returning({ id: outbox.id });

    if (!updated) {
      throw new Error("Email accepted but Outbox completion failed");
    }

    console.log(`[Email Worker] Outbox COMPLETED: ${updated.id}`);

    return {
      simulated: false,
      provider: "resend",
      emailId,
    };
  },

  {
    connection,
    concurrency: 3,
    limiter: { max: 2, duration: 1000 },
  },
);

// Theo dõi trạng thái Worker
worker.on("ready", () => {
  console.log("[Email Worker] Ready");
});

worker.on("completed", (job) => {
  console.log(`[Email Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[Email Worker] Job ${job?.id} failed: ${error.message}`);
});

worker.on("error", (error) => {
  console.error("[Email Worker] Error:", error.message);
});

// Đóng kết nối khi dừng chương trình
async function shutdown() {
  await worker.close();
  await connection.quit();
  await sqlClient.end();
}

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});
