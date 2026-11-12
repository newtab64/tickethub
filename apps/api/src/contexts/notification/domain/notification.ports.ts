import type {
  EmailJobData,
  PaymentExpiredRefundNoticePayload,
  ReviewEventType,
  ReviewNotificationPayload,
  UserRegisteredPayload,
} from "./email.types";

export interface PendingOutboxEvent {
  id: string;
  eventType: string;
  payload: unknown;
  retryCount: number;
}

export interface PendingOutboxFilter {
  eventTypes: string[];
  /** Chi lay dung mot ban ghi (che do kiem thu Review). */
  onlyId?: string | undefined;
  /** Chi lay ban ghi co payload.email trung (che do kiem thu). */
  onlyEmail?: string | undefined;
  limit: number;
  now: Date;
}

export interface StoredOutboxEvent {
  id: string;
  eventType: string;
  payload: unknown;
  status: string;
}

export interface StaleOutboxEvent {
  id: string;
  eventType: string;
  status: string;
  retryCount: number;
  updatedAt: Date;
}

/** Cong luu tru outbox (PostgreSQL). Moi thao tac chuyen trang thai la cap nhat co dieu kien. */
export interface OutboxStore {
  findPending(filter: PendingOutboxFilter): Promise<PendingOutboxEvent[]>;
  /** PENDING -> PROCESSING nguyen tu; false neu da co nguoi khac claim. */
  claim(id: string, now: Date): Promise<boolean>;
  /** PROCESSING -> PENDING sau khi enqueue that bai, hen thu lai. */
  releaseForRetry(input: {
    id: string;
    retryCount: number;
    nextRetryAt: Date;
    errorMessage: string;
    now: Date;
  }): Promise<void>;
  findById(id: string): Promise<StoredOutboxEvent | null>;
  /** PROCESSING -> COMPLETED; false neu trang thai da doi. */
  complete(id: string, now: Date): Promise<boolean>;
  findStaleProcessing(input: {
    eventType: string;
    olderThan: Date;
    onlyId?: string | undefined;
    limit: number;
  }): Promise<StaleOutboxEvent[]>;
  /** PROCESSING -> FAILED neu ban ghi khong doi ke tu luc doc; false neu bi doi dong thoi. */
  markFailedIfUnchanged(input: {
    event: StaleOutboxEvent;
    olderThan: Date;
    errorMessage: string;
    now: Date;
  }): Promise<boolean>;
}

export interface QueuedEmailJob {
  data: EmailJobData | undefined;
  state: string;
  attemptsMade: number;
  maxAttempts: number;
}

/** Cong hang doi email (BullMQ). */
export interface EmailJobQueue {
  findJob(jobId: string): Promise<QueuedEmailJob | null>;
  enqueueRegistration(
    outboxId: string,
    payload: UserRegisteredPayload,
  ): Promise<{ id?: string | undefined }>;
  enqueueReview(
    outboxId: string,
    eventType: ReviewEventType,
    payload: ReviewNotificationPayload,
  ): Promise<{ id?: string | undefined }>;
  enqueueRefundNotice(
    outboxId: string,
    payload: PaymentExpiredRefundNoticePayload,
  ): Promise<{ id?: string | undefined }>;
}

/** Cong gui email (Resend). Tra ve ma email cua nha cung cap. */
export interface EmailSender {
  sendRegistration(
    outboxId: string,
    payload: UserRegisteredPayload,
  ): Promise<string>;
  sendReview(
    outboxId: string,
    eventType: ReviewEventType,
    payload: ReviewNotificationPayload,
  ): Promise<string>;
  sendRefundNotice(
    outboxId: string,
    payload: PaymentExpiredRefundNoticePayload,
  ): Promise<string>;
}

export interface Logger {
  log(message: string, ...rest: unknown[]): void;
  warn(message: string, ...rest: unknown[]): void;
  error(message: string, ...rest: unknown[]): void;
}
