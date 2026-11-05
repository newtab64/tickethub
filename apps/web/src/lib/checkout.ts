import {
  OrderStatus,
  type TicketStatus,
  type RefundPolicyType,
} from "@tickethub/shared";

export function remainingSeconds(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function paymentState(
  status: OrderStatus,
): "success" | "failed" | "processing" | "refunded" {
  if (status === OrderStatus.PAID) return "success";
  if (status === OrderStatus.REFUNDED) return "refunded";
  if (status === OrderStatus.PENDING) return "processing";
  return "failed";
}

export function safePaymentUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["sandbox.vnpayment.vn", "pay.vnpay.vn"].includes(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Địa chỉ thanh toán VNPay không hợp lệ.");
  }
  return url.href;
}

export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thanh toán thất bại",
  EXPIRED: "Hết hạn giữ chỗ",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hủy toàn bộ vé",
};

export const ticketStatusLabel: Record<TicketStatus, string> = {
  SOLD: "Còn hiệu lực",
  CHECKED_IN: "Đã sử dụng",
  CANCELLED: "Đã hủy",
};
export const refundPolicyLabel: Record<RefundPolicyType, string> = {
  FLEXIBLE: "Linh hoạt",
  STRICT: "Nghiêm ngặt",
  NO_REFUND: "Không hoàn tiền",
  CUSTOM: "Theo sự kiện",
};
export function refundStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Chờ xử lý",
    PROCESSING: "Đang xử lý",
    COMPLETED: "Đã hoàn tiền",
    FAILED: "Hoàn tiền thất bại",
  };
  return labels[status] ?? "Đang đối soát";
}
