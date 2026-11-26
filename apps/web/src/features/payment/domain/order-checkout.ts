import {
  OrderStatus,
  type TicketStatus,
  type RefundPolicyType,
  type CheckoutOrder,
} from "@tickethub/shared";

/** Thời gian giữ chỗ chuẩn của một đơn, tính bằng giây. */
export const HOLD_SECONDS = 300;

export function remainingSeconds(deadline: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Định dạng số giây thành MM:SS cho đồng hồ giữ chỗ. */
export function formatTimer(seconds: number): string {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Tên khu trong dữ liệu có thể đã bắt đầu bằng "Khu". */
export function zoneLabel(zoneName: string): string {
  return zoneName.startsWith("Khu") ? zoneName : `Khu ${zoneName}`;
}

/**
 * Thông báo khi tạo thanh toán thất bại, theo mã HTTP (0 là mất kết nối).
 * Không hiển thị thông điệp thô từ backend.
 */
export function paymentFailureMessage(status: number): string {
  switch (status) {
    case 0:
      return "Không kết nối được máy chủ thanh toán. Vui lòng kiểm tra mạng và thử lại.";
    case 401:
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để thanh toán.";
    case 403:
      return "Tài khoản của bạn không có quyền thanh toán đơn hàng này.";
    case 404:
      return "Không tìm thấy đơn hàng. Vui lòng quay lại trang đặt vé và chọn vé lại.";
    case 409:
      return "Đơn hàng đã hết hạn giữ chỗ hoặc không còn ở trạng thái chờ thanh toán. Vui lòng đặt vé lại.";
    case 429:
      return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.";
    default:
      return "Không thể tạo thanh toán lúc này. Vui lòng thử lại sau.";
  }
}

export type HoldTone = "calm" | "soon" | "urgent";

/** Mức gấp của đồng hồ giữ chỗ: cam từ 120 giây, đỏ dưới 60 giây. */
export function holdTone(seconds: number): HoldTone {
  if (seconds < 60) return "urgent";
  return seconds <= 120 ? "soon" : "calm";
}

export interface SeatRow {
  id: string;
  badge: string;
  title: string;
  detail: string;
  amount: number;
}

/** Dòng hiển thị cho từng mục đơn; vé đứng không có hàng ghế. */
export function seatRows(items: CheckoutOrder["items"]): SeatRow[] {
  return items.map(({ id, quantity, subtotal, ticketType, seat }) => {
    const row = { id, amount: subtotal };
    if (!ticketType.isSeated)
      return {
        ...row,
        badge: String(quantity),
        title: `Khu vực: ${ticketType.name} (Vé đứng)`,
        detail: `${quantity} vé`,
      };
    if (!seat)
      return {
        ...row,
        badge: "?",
        title: ticketType.name,
        detail: "Vị trí ghế chưa được xác nhận",
      };
    return {
      ...row,
      badge: seat.seatNumber,
      title: zoneLabel(seat.zoneName),
      detail: `Hàng ${seat.rowLabel}, ghế ${seat.seatNumber}`,
    };
  });
}

export function paymentState(
  status: OrderStatus,
): "success" | "failed" | "processing" | "refunded" | "refund_pending" {
  if (status === OrderStatus.PAID) return "success";
  if (status === OrderStatus.PAYMENT_EXPIRED_REFUND_PENDING)
    return "refund_pending";
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
  PAYMENT_EXPIRED_REFUND_PENDING: "Hết hạn giữ chỗ, đang chờ hoàn tiền",
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
