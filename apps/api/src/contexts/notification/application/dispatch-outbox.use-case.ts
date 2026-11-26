import {
  PaymentExpiredRefundNoticePayloadSchema,
  REFUND_NOTICE_EVENT_TYPE,
  REVIEW_EVENT_TYPES,
  UserRegisteredPayloadSchema,
  parseReviewPayload,
} from "../domain/email.types";
import type {
  PaymentExpiredRefundNoticePayload,
  ReviewEventType,
  ReviewNotificationPayload,
  UserRegisteredPayload,
} from "../domain/email.types";
import {
  DISPATCH_MODE_LABEL,
  isAllowedForMode,
  type DispatchOptions,
} from "../domain/dispatch-mode";
import type {
  EmailJobQueue,
  Logger,
  OutboxStore,
} from "../domain/notification.ports";

const RETRY_DELAY_MS = 30_000;

export interface DispatchResult {
  found: number;
  failed: number;
}

/**
 * Doc outbox PENDING (email dang ky, thong bao duyet) va dua vao hang doi email.
 * Claim nguyen tu truoc khi enqueue; enqueue loi thi tra ve PENDING va hen thu lai.
 * Che do DRY_RUN chi kiem tra payload, khong ghi du lieu.
 */
export class DispatchOutboxUseCase {
  constructor(
    private readonly store: OutboxStore,
    private readonly queue: EmailJobQueue,
    private readonly logger: Logger,
  ) {}

  async run(
    options: DispatchOptions,
    testEmail: string | undefined,
  ): Promise<DispatchResult> {
    this.logger.log(`[Dispatcher] Mode: ${DISPATCH_MODE_LABEL[options.mode]}`);

    const reviewTest = options.mode === "REVIEW_TEST";
    const events = await this.store.findPending({
      eventTypes: reviewTest
        ? [...REVIEW_EVENT_TYPES]
        : ["USER_REGISTERED", ...REVIEW_EVENT_TYPES, REFUND_NOTICE_EVENT_TYPE],
      onlyId: reviewTest ? options.targetOutboxId : undefined,
      onlyEmail: options.mode === "EMAIL_TEST" ? testEmail : undefined,
      limit: reviewTest ? 1 : 10,
      now: new Date(),
    });
    this.logger.log(`[Dispatcher] Found ${events.length} events`);

    let failed = 0;
    for (const event of events) {
      try {
        await this.dispatchOne(event, options, testEmail);
      } catch (error) {
        failed++;
        this.logger.error(
          `[Dispatcher] Failed ${event.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    this.logger.log("[Dispatcher] Finished");
    return { found: events.length, failed };
  }

  private async dispatchOne(
    event: {
      id: string;
      eventType: string;
      payload: unknown;
      retryCount: number;
    },
    options: DispatchOptions,
    testEmail: string | undefined,
  ) {
    const isRegistration = event.eventType === "USER_REGISTERED";
    const isReview = (REVIEW_EVENT_TYPES as readonly string[]).includes(
      event.eventType,
    );
    const isRefundNotice = event.eventType === REFUND_NOTICE_EVENT_TYPE;
    if (!isRegistration && !isReview && !isRefundNotice) {
      throw new Error("Unsupported event type");
    }

    const registration: UserRegisteredPayload | null = isRegistration
      ? UserRegisteredPayloadSchema.parse(event.payload)
      : null;
    const review: ReviewNotificationPayload | null = isReview
      ? parseReviewPayload(event.eventType as ReviewEventType, event.payload)
      : null;

    const notice: PaymentExpiredRefundNoticePayload | null = isRefundNotice
      ? PaymentExpiredRefundNoticePayloadSchema.parse(event.payload)
      : null;

    if (options.mode === "DRY_RUN") {
      this.logger.log(`[Dispatcher] Valid: ${event.eventType} / ${event.id}`);
      return;
    }

    const allowed = isAllowedForMode(
      options,
      {
        ...(registration
          ? {
              registrationEmail: registration.email,
              token: registration.verificationToken,
            }
          : {}),
        ...(review ? { reviewEmail: review.email } : {}),
      },
      testEmail,
    );
    if (!allowed) {
      if (options.mode === "REVIEW_TEST") {
        this.logger.log(`[Dispatcher] Skipped recipient: ${event.id}`);
      }
      return;
    }

    // Kiem tra job trung trong Redis
    const jobId = `outbox_${event.id}`;
    if (await this.queue.findJob(jobId)) {
      this.logger.warn(`[Dispatcher] Existing job ${jobId}`);
      this.logger.warn("[Dispatcher] Manual reconciliation required");
      return;
    }

    // Claim outbox nguyen tu
    if (!(await this.store.claim(event.id, new Date()))) {
      this.logger.log(`[Dispatcher] Already claimed: ${event.id}`);
      return;
    }

    try {
      const job = notice
        ? await this.queue.enqueueRefundNotice(event.id, notice)
        : review
          ? await this.queue.enqueueReview(
              event.id,
              event.eventType as ReviewEventType,
              review,
            )
          : await this.queue.enqueueRegistration(event.id, registration!);
      this.logger.log(`[Dispatcher] Enqueued: ${job.id}`);
    } catch (error) {
      // Chi tra lai PENDING khi enqueue that bai
      await this.store.releaseForRetry({
        id: event.id,
        retryCount: event.retryCount + 1,
        nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        now: new Date(),
      });
      throw error;
    }
  }
}
