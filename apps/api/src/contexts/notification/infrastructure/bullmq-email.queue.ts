import { Queue } from "bullmq";
import { env } from "../../../config/env.config";

import {
  EMAIL_QUEUE_NAME,
  PaymentExpiredRefundNoticePayloadSchema,
  UserRegisteredPayloadSchema,
  parseReviewPayload,
} from "../domain/email.types";

import type {
  EmailJobData,
  PaymentExpiredRefundNoticePayload,
  UserRegisteredPayload,
  ReviewEventType,
  ReviewNotificationPayload,
} from "../domain/email.types";

import type {
  EmailJobQueue,
  QueuedEmailJob,
} from "../domain/notification.ports";

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

// Email giai thich hoan tien do thanh toan quá han giu cho
export async function enqueueRefundNoticeEmail(
  outboxId: string,
  payload: PaymentExpiredRefundNoticePayload,
) {
  const validPayload = PaymentExpiredRefundNoticePayloadSchema.parse(payload);

  return emailQueue.add(
    "refund-notice",
    {
      outboxId,
      eventType: "PAYMENT_EXPIRED_REFUND_NOTICE",
      payload: validPayload,
    },
    {
      jobId: `outbox_${outboxId}`,
    },
  );
}

/** Adapter cong hang doi email tren BullMQ. */
export class BullMqEmailQueue implements EmailJobQueue {
  async findJob(jobId: string): Promise<QueuedEmailJob | null> {
    const job = await emailQueue.getJob(jobId);
    if (!job) return null;
    return {
      data: job.data,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    };
  }

  enqueueRegistration(outboxId: string, payload: UserRegisteredPayload) {
    return enqueueRegistrationEmail(outboxId, payload);
  }

  enqueueReview(
    outboxId: string,
    eventType: ReviewEventType,
    payload: ReviewNotificationPayload,
  ) {
    return enqueueReviewEmail(outboxId, eventType, payload);
  }

  enqueueRefundNotice(
    outboxId: string,
    payload: PaymentExpiredRefundNoticePayload,
  ) {
    return enqueueRefundNoticeEmail(outboxId, payload);
  }

  close(): Promise<void> {
    return emailQueue.close();
  }
}
