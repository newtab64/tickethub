import { Queue } from "bullmq";
import { env } from "../config/env.config";

import {
  EMAIL_QUEUE_NAME,
  UserRegisteredPayloadSchema,
  parseReviewPayload,
  OrderPaidPayloadSchema,
} from "./email.types";

import type {
  EmailJobData,
  UserRegisteredPayload,
  ReviewEventType,
  ReviewNotificationPayload,
  OrderPaidPayload,
} from "./email.types";

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

// Sử dụng lại queue có sẵn của TicketHub
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400,
    },
    removeOnFail: {
      age: 604800,
    },
  },
});

// Email đăng ký tài khoản - tuần 1
export async function enqueueRegistrationEmail(
  outboxId: string,
  payload: UserRegisteredPayload,
) {
  const validPayload = UserRegisteredPayloadSchema.parse(payload);

  return emailQueue.add(
    "user-registered",
    {
      outboxId,
      eventType: "USER_REGISTERED",
      payload: validPayload,
    },
    {
      jobId: `outbox_${outboxId}`,
    },
  );
}

// Email thông báo Admin - tuần 2
export async function enqueueReviewEmail(
  outboxId: string,
  eventType: ReviewEventType,
  payload: ReviewNotificationPayload,
) {
  const validPayload = parseReviewPayload(eventType, payload);

  return emailQueue.add(
    "admin-review",
    {
      outboxId,
      eventType,
      payload: validPayload,
    },
    {
      jobId: `outbox_${outboxId}`,
    },
  );
}

// W04: stable jobId + durable Outbox makes enqueue idempotent.
export async function enqueueOrderPaidEmail(
  outboxId: string,
  payload: OrderPaidPayload,
) {
  const validPayload = OrderPaidPayloadSchema.parse(payload);
  return emailQueue.add(
    "order-paid",
    { outboxId, eventType: "ORDER_PAID", payload: validPayload },
    { jobId: `outbox_${outboxId}` },
  );
}
