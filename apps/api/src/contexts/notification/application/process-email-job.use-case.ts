import { isDeepStrictEqual } from "node:util";
import { OutboxStatus } from "@tickethub/shared";
import {
  PaymentExpiredRefundNoticePayloadSchema,
  REFUND_NOTICE_EVENT_TYPE,
  REVIEW_EVENT_TYPES,
  UserRegisteredPayloadSchema,
  parseReviewPayload,
} from "../domain/email.types";
import type { EmailJobData, ReviewEventType } from "../domain/email.types";
import type {
  EmailSender,
  Logger,
  OutboxStore,
} from "../domain/notification.ports";

export interface EmailWorkerConfig {
  /** mock | live-test | live */
  mode: string;
  testEmailTo?: string | undefined;
  realEmailEnabled: boolean;
}

export type ProcessEmailJobResult =
  | { alreadyCompleted: true }
  | { simulated: true }
  | { simulated: false; provider: "resend"; emailId: string };

/**
 * Xu ly mot job email: doi chieu payload Redis voi PostgreSQL, chong xu ly lai,
 * gui email theo che do (mock, live-test, live) roi danh dau outbox COMPLETED.
 */
export class ProcessEmailJobUseCase {
  constructor(
    private readonly store: OutboxStore,
    private readonly sender: EmailSender,
    private readonly config: EmailWorkerConfig,
    private readonly logger: Logger,
  ) {}

  async execute(job: {
    name: string;
    data: EmailJobData;
  }): Promise<ProcessEmailJobResult> {
    const { outboxId, eventType } = job.data;
    const isRegistration = eventType === "USER_REGISTERED";
    const isNotice = eventType === REFUND_NOTICE_EVENT_TYPE;

    if (isRegistration) {
      if (job.name !== "user-registered") {
        throw new Error("Invalid registration job");
      }
    } else if (isNotice) {
      if (job.name !== "refund-notice") {
        throw new Error("Invalid refund notice job");
      }
    } else if (
      job.name !== "admin-review" ||
      !REVIEW_EVENT_TYPES.includes(eventType as ReviewEventType)
    ) {
      throw new Error(`Unsupported job: ${job.name}`);
    }

    this.logger.log(`[Email Worker] Processing: ${outboxId}`);

    const event = await this.store.findById(outboxId);
    if (!event || event.eventType !== eventType) {
      throw new Error("Matching Outbox event not found");
    }

    const reviewType = eventType as ReviewEventType;
    const parsePayload = (raw: unknown) =>
      isRegistration
        ? UserRegisteredPayloadSchema.parse(raw)
        : isNotice
          ? PaymentExpiredRefundNoticePayloadSchema.parse(raw)
          : parseReviewPayload(reviewType, raw);
    const jobPayload = parsePayload(job.data.payload);
    const storedPayload = parsePayload(event.payload);

    // Khong dung du lieu Redis neu khac PostgreSQL
    if (!isDeepStrictEqual(jobPayload, storedPayload)) {
      throw new Error("Job payload does not match Outbox");
    }

    if (event.status === OutboxStatus.COMPLETED) {
      this.logger.log("[Email Worker] Already completed");
      return { alreadyCompleted: true };
    }
    if (event.status !== OutboxStatus.PROCESSING) {
      throw new Error(`Unexpected Outbox status: ${event.status}`);
    }

    const { mode } = this.config;
    if (mode === "mock") {
      // Giu outbox PROCESSING, khong gia mao da gui
      this.logger.log("[Email Worker] Mock only - no email sent");
      return { simulated: true };
    }
    if (mode === "live-test") {
      const testEmail = this.config.testEmailTo?.trim().toLowerCase();
      if (!testEmail || storedPayload.email.toLowerCase() !== testEmail) {
        throw new Error("Recipient is not TEST_EMAIL_TO");
      }
    } else if (mode === "live") {
      if (!this.config.realEmailEnabled) {
        throw new Error("Real email sending is disabled");
      }
    } else {
      throw new Error(`Unsupported mode: ${mode}`);
    }

    const emailId = isRegistration
      ? await this.sender.sendRegistration(
          event.id,
          UserRegisteredPayloadSchema.parse(storedPayload),
        )
      : isNotice
        ? await this.sender.sendRefundNotice(
            event.id,
            PaymentExpiredRefundNoticePayloadSchema.parse(storedPayload),
          )
        : await this.sender.sendReview(
            event.id,
            reviewType,
            parseReviewPayload(reviewType, storedPayload),
          );

    // Cap nhat outbox sau khi nha cung cap chap nhan
    if (!(await this.store.complete(event.id, new Date()))) {
      throw new Error("Email accepted but Outbox completion failed");
    }
    this.logger.log(`[Email Worker] Outbox COMPLETED: ${event.id}`);

    return { simulated: false, provider: "resend", emailId };
  }
}
