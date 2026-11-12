import { Resend } from "resend";
import { env } from "../../../config/env.config";
import {
  PaymentExpiredRefundNoticePayloadSchema,
  parseReviewPayload,
} from "../domain/email.types";

import type { EmailSender } from "../domain/notification.ports";
import type {
  PaymentExpiredRefundNoticePayload,
  UserRegisteredPayload,
  ReviewEventType,
  ReviewNotificationPayload,
} from "../domain/email.types";

export async function sendRegistrationEmail(
  outboxId: string,
  payload: UserRegisteredPayload,
): Promise<string> {
  // env import ensures local .env has been loaded.
  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const from = env.EMAIL_FROM || process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(
      "Email is not configured: RESEND_API_KEY or EMAIL_FROM is missing",
    );
  }

  if (env.NODE_ENV === "production" && from.includes("resend.dev")) {
    const sender = from.trim().toLowerCase();

    const validTestSender =
      sender === "onboarding@resend.dev" ||
      sender === "tickethub <onboarding@resend.dev>";

    const allowTestEmail =
      process.env.EMAIL_WORKER_MODE === "live-test" &&
      process.env.ALLOW_RESEND_TEST_SENDER === "true" &&
      validTestSender &&
      !!process.env.TEST_EMAIL_TO &&
      payload.email.trim().toLowerCase() ===
        process.env.TEST_EMAIL_TO.trim().toLowerCase();

    if (!allowTestEmail) {
      throw new Error("Configure a verified sender domain for production");
    }
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send(
    {
      from,
      to: payload.email,
      subject: "Xác thực tài khoản TicketHub",
      text: [
        `Xin chào ${payload.fullName},`,
        "",
        "Cảm ơn bạn đã đăng ký TicketHub.",
        "Mã xác thực tài khoản của bạn:",
        payload.verificationToken,
        "",
        "Vui lòng sử dụng mã xác thực theo hướng dẫn của TicketHub.",
        "Nếu bạn không đăng ký, hãy bỏ qua email này.",
      ].join("\n"),
    },
    {
      idempotencyKey: `registration/${outboxId}`,
    },
  );

  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email ID");
  }

  return data.id;
}

export async function sendReviewEmail(
  outboxId: string,
  eventType: ReviewEventType,
  payload: ReviewNotificationPayload,
): Promise<string> {
  // 1. Kiểm tra dữ liệu
  const valid = parseReviewPayload(eventType, payload);

  // 2. Kiểm tra cấu hình email
  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const from = env.EMAIL_FROM || process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Chưa cấu hình RESEND_API_KEY hoặc EMAIL_FROM");
  }

  // Không dùng địa chỉ thử nghiệm làm sender production
  if (
    env.NODE_ENV === "production" &&
    from.toLowerCase().includes("resend.dev")
  ) {
    throw new Error("Production cần tên miền gửi email đã xác minh");
  }

  // 3. Xác định nội dung thông báo
  const approved = eventType.endsWith("APPROVED");
  const isOrganizer = eventType.startsWith("ORGANIZER_");

  const objectType = isOrganizer ? "Hồ sơ Ban tổ chức" : "Sự kiện";

  const objectName =
    "organizationName" in valid ? valid.organizationName : valid.eventTitle;

  const subject = approved
    ? `[TicketHub] ${objectType} đã được duyệt`
    : `[TicketHub] ${objectType} bị từ chối`;

  const message = [
    "Xin chào,",
    "",
    `${objectType} "${objectName}" ${
      approved ? "đã được phê duyệt." : "chưa được phê duyệt."
    }`,
    ...(!approved && valid.reason ? [`Lý do: ${valid.reason}`] : []),
    "",
    "Vui lòng đăng nhập TicketHub để xem chi tiết.",
    "",
    "Trân trọng,",
    "Đội ngũ TicketHub",
  ].join("\n");

  // 4. Gửi email qua Resend
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send(
    {
      from,
      to: valid.email,
      subject,
      text: message,
    },
    {
      idempotencyKey: `admin-review/${outboxId}`,
    },
  );

  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Resend không trả về Email ID");
  }

  return data.id;
}

export async function sendRefundNoticeEmail(
  outboxId: string,
  payload: PaymentExpiredRefundNoticePayload,
): Promise<string> {
  const valid = PaymentExpiredRefundNoticePayloadSchema.parse(payload);

  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const from = env.EMAIL_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Chưa cấu hình RESEND_API_KEY hoặc EMAIL_FROM");
  }
  if (
    env.NODE_ENV === "production" &&
    from.toLowerCase().includes("resend.dev")
  ) {
    throw new Error("Production cần tên miền gửi email đã xác minh");
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: valid.email,
      subject: `[TicketHub] Hoàn tiền đơn hàng ${valid.orderCode}`,
      text: [
        `Xin chào ${valid.fullName},`,
        "",
        `Thanh toán của bạn cho đơn hàng ${valid.orderCode} được ghi nhận sau khi thời gian giữ chỗ (5 phút) đã kết thúc, và các vé đã không còn khả dụng để cấp lại.`,
        `TicketHub sẽ hoàn lại 100% số tiền ${valid.amount} VND qua VNPay về phương thức thanh toán ban đầu.`,
        "Thời gian ghi nhận tiền về tùy thuộc vào ngân hàng của bạn.",
        "",
        "Chúng tôi xin lỗi vì sự bất tiện này.",
        "",
        "Trân trọng,",
        "Đội ngũ TicketHub",
      ].join("\n"),
    },
    {
      idempotencyKey: `refund-notice/${outboxId}`,
    },
  );
  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend không trả về Email ID");
  }
  return data.id;
}

/** Adapter cong gui email tren Resend. */
export class ResendEmailSender implements EmailSender {
  sendRegistration(outboxId: string, payload: UserRegisteredPayload) {
    return sendRegistrationEmail(outboxId, payload);
  }

  sendReview(
    outboxId: string,
    eventType: ReviewEventType,
    payload: ReviewNotificationPayload,
  ) {
    return sendReviewEmail(outboxId, eventType, payload);
  }

  sendRefundNotice(
    outboxId: string,
    payload: PaymentExpiredRefundNoticePayload,
  ) {
    return sendRefundNoticeEmail(outboxId, payload);
  }
}
