import { z } from "zod";

export const EMAIL_QUEUE_NAME = "tickethub-email";

// 1. Email đăng ký tài khoản (tuần 1)
export const UserRegisteredPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  verificationToken: z.string().min(1),
});

export type UserRegisteredPayload = z.infer<typeof UserRegisteredPayloadSchema>;

// 2. Các loại thông báo Admin (tuần 2)
export const REVIEW_EVENT_TYPES = [
  "ORGANIZER_APPROVED",
  "ORGANIZER_REJECTED",
  "EVENT_APPROVED",
  "EVENT_REJECTED",
] as const;

export type ReviewEventType = (typeof REVIEW_EVENT_TYPES)[number];

// 3. Các trường chung của thông báo duyệt
const ReviewBaseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().nullable().optional(),
});

// 4. Thông báo dành cho Ban tổ chức
export const OrganizerReviewPayloadSchema = ReviewBaseSchema.extend({
  profileId: z.string().uuid(),
  organizationName: z.string().min(1),
});

// 5. Thông báo dành cho sự kiện
export const EventReviewPayloadSchema = ReviewBaseSchema.extend({
  eventId: z.string().uuid(),
  organizerId: z.string().uuid(),
  eventTitle: z.string().min(1),
});

export type ReviewNotificationPayload =
  | z.infer<typeof OrganizerReviewPayloadSchema>
  | z.infer<typeof EventReviewPayloadSchema>;

// 6. Kiểm tra payload theo loại sự kiện
export function parseReviewPayload(
  eventType: ReviewEventType,
  payload: unknown,
): ReviewNotificationPayload {
  const parsed = eventType.startsWith("ORGANIZER_")
    ? OrganizerReviewPayloadSchema.parse(payload)
    : EventReviewPayloadSchema.parse(payload);

  const expectedDecision = eventType.endsWith("APPROVED")
    ? "APPROVE"
    : "REJECT";

  if (parsed.decision !== expectedDecision) {
    throw new Error("Review decision does not match event type");
  }

  return parsed;
}

// W04: confirmation payload is persisted atomically with ORDER_PAID.
// Email and ticket codes must be queried from PostgreSQL by the worker.
export const OrderPaidPayloadSchema = z.object({
  orderId: z.string().uuid(),
  orderCode: z.string().min(1),
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
  transactionId: z.string().uuid(),
  transactionRef: z.string().min(1),
  provider: z.literal("VNPAY"),
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  ticketIds: z.array(z.string().uuid()).min(1),
  paidAt: z.string().datetime({ offset: true }),
});

export type OrderPaidPayload = z.infer<typeof OrderPaidPayloadSchema>;

// 7. Kiểu dữ liệu gửi vào BullMQ
export type EmailJobData =
  | {
      outboxId: string;
      eventType: "USER_REGISTERED";
      payload: UserRegisteredPayload;
    }
  | {
      outboxId: string;
      eventType: ReviewEventType;
      payload: ReviewNotificationPayload;
    }
  | {
      outboxId: string;
      eventType: "ORDER_PAID";
      payload: OrderPaidPayload;
    };
