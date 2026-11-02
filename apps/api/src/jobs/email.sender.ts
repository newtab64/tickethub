import { Resend } from "resend";
import { env } from "../config/env.config";
import { parseReviewPayload } from "./email.types";

import type {
  UserRegisteredPayload,
  ReviewEventType,
  ReviewNotificationPayload,
  OrderPaidPayload,
} from "./email.types";

let client: Resend | null = null;

function getMailer(): { resend: Resend; from: string } {
  const apiKey = env.RESEND_API_KEY || process.env.RESEND_API_KEY;
  const from = env.EMAIL_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email is not configured");
  }
  if (
    env.NODE_ENV === "production" &&
    from.toLowerCase().includes("resend.dev")
  ) {
    throw new Error("Production requires a verified sending domain");
  }
  client ??= new Resend(apiKey);
  return { resend: client, from };
}

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
  const { resend, from } = getMailer();

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

// Unit-testable, safe plain-text confirmation. Do not embed QR/JWT in email.
export function composeOrderPaidEmail(
  payload: OrderPaidPayload,
  ticketCodes: string[],
): { subject: string; text: string } {
  return {
    subject: `[TicketHub] Thanh toán thành công - ${payload.orderCode}`,
    text: [
      "Thanh toán đơn hàng đã được xác nhận.",
      `Mã đơn hàng: ${payload.orderCode}`,
      `Số tiền: ${payload.amount} VND`,
      `Mã vé: ${ticketCodes.join(", ")}`,
      "",
      "Đăng nhập TicketHub để xem vé và lấy QR động.",
      "Không sử dụng email này làm mã QR để vào cổng.",
    ].join("\n"),
  };
}

export async function sendOrderPaidEmail(
  outboxId: string,
  payload: OrderPaidPayload,
  recipient: string,
  ticketCodes: string[],
): Promise<string> {
  const { resend, from } = getMailer();

  const message = composeOrderPaidEmail(payload, ticketCodes);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: recipient,
      ...message,
    },
    {
      // A rejected test send used the original key with a DIFFERENT recipient.
      // For exactly one isolated live-test Outbox, use a stable, distinct key.
      // This avoids Resend's 409 payload/key conflict on retry, while keeping
      // retries of this test email idempotent.
      idempotencyKey:
        env.NODE_ENV === "test" &&
        new URL(env.DATABASE_URL).pathname === "/tickethub_w04_test" &&
        new URL(env.REDIS_URL).pathname === "/15" &&
        process.env.EMAIL_WORKER_MODE === "live-test" &&
        process.env.ENABLE_ORDER_PAID_EMAIL_TEST === "true" &&
        process.env.TEST_ORDER_PAID_OUTBOX_ID === outboxId &&
        outboxId === "7a2df97c-7f7d-4540-a375-b46db47011b2" &&
        recipient.trim().toLowerCase() === "nguyentuankhoi2603@gmail.com"
          ? `order-paid-test-redirect/${outboxId}/v1`
          : `order-paid/${outboxId}`,
    },
  );
  if (error || !data?.id) {
    throw new Error(`Resend ORDER_PAID failed: ${error?.message ?? "No ID"}`);
  }
  return data.id;
}
