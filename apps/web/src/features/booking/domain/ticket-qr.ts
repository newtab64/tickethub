import { isRefundRejected } from "@tickethub/shared";

export const QR_SOON_SECONDS = 5;

/** Chỉ vé còn hiệu lực của sự kiện đang mở mới xin được mã QR. */
export function canShowQr(
  ticket: { status: string },
  eventStatus: string,
): boolean {
  return ticket.status === "SOLD" && eventStatus === "PUBLISHED";
}

/** Một thời điểm theo đồng hồ tường và đồng hồ đơn điệu (performance.now). */
export interface QrInstant {
  wall: number;
  mono: number;
}

/**
 * Thời gian đã trôi: lấy số lớn hơn của hai đồng hồ. Đồng hồ tường tính cả lúc
 * máy ngủ, đồng hồ đơn điệu không bị ảnh hưởng khi người dùng chỉnh giờ.
 */
export function qrElapsedMs(since: QrInstant, now: QrInstant): number {
  return Math.max(now.wall - since.wall, now.mono - since.mono);
}

/**
 * Số giây còn lại, tính từ lúc GỬI yêu cầu: mã được ký sau đó, nên mạng chậm
 * không làm mã hết hạn trông như còn mới.
 */
export function qrSecondsLeft(
  sentAt: QrInstant,
  remainingSeconds: number,
  now: QrInstant,
): number {
  const left = Math.ceil(remainingSeconds - qrElapsedMs(sentAt, now) / 1000);
  return Math.min(remainingSeconds, Math.max(0, left));
}

/** Máy chủ từ chối cấp mã (khác với lỗi tạm thời có thể thử lại). */
export function isQrRejection(status: number | null): boolean {
  return (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

export type QrView = "loading" | "live" | "soon" | "offline" | "rejected";

export function qrView({
  hasToken,
  secondsLeft,
  errorStatus,
}: {
  hasToken: boolean;
  secondsLeft: number;
  errorStatus: number | null;
}): QrView {
  if (isQrRejection(errorStatus)) return "rejected";
  if (hasToken && secondsLeft > 0) {
    return secondsLeft <= QR_SOON_SECONDS ? "soon" : "live";
  }
  return errorStatus === null ? "loading" : "offline";
}

interface OrderForView<T extends { status: string }> {
  status: string;
  event: { status: string };
  tickets: T[];
  refunds?: { status: string }[];
}

/** Đơn trả muộn mà VNPay từ chối hoàn tiền. */
function lateRefundRejected(order: OrderForView<{ status: string }>) {
  return (
    order.status === "PAYMENT_EXPIRED_REFUND_PENDING" &&
    isRefundRejected(order.refunds ?? [])
  );
}

export function orderStatusText(
  order: OrderForView<{ status: string }>,
  label: string,
): string {
  return lateRefundRejected(order)
    ? "Hết hạn giữ chỗ, chưa hoàn được tiền"
    : label;
}

/** Việc chính của trang đơn: trả tiền, hiện mã vào cổng, hoặc không có. */
export function primaryAction(
  order: OrderForView<{ status: string }>,
): "pay" | "qr" | "none" {
  if (order.status === "PENDING") return "pay";
  return order.tickets.some((t) => canShowQr(t, order.event.status))
    ? "qr"
    : "none";
}

const NO_TICKET_REASON: Record<string, string> = {
  PAID: "Vé sẽ xuất hiện sau khi hệ thống xác nhận thanh toán thành công.",
  PAYMENT_EXPIRED_REFUND_PENDING:
    "Thanh toán đến muộn nên không cấp được vé. Tiền đang được hoàn lại cho bạn.",
  EXPIRED: "Đơn đã hết hạn giữ chỗ nên không có vé.",
  FAILED: "Thanh toán không thành công nên không có vé.",
  CANCELLED: "Đơn đã hủy nên không có vé.",
};

export function noQrReason(
  order: OrderForView<{ status: string }>,
): string | null {
  if (primaryAction(order) !== "none") return null;
  if (lateRefundRejected(order)) {
    return "Hoàn tiền chưa thực hiện được. Hãy liên hệ hỗ trợ kèm mã đơn.";
  }
  if (order.tickets.length === 0) {
    return NO_TICKET_REASON[order.status] ?? "Đơn này không có vé.";
  }
  if (order.event.status !== "PUBLISHED") {
    return "Sự kiện hiện không mở vào cổng nên chưa có mã.";
  }
  return "Đơn này không còn vé hiệu lực.";
}

interface SeatedLabel {
  isSeated?: boolean;
  seatInfo?: {
    rowLabel: string | null;
    seatNumber: string | null;
    formattedLabel: string;
  };
}

/** Dòng phụ của vé: hàng và ghế; vé đứng giữ nguyên nhãn của backend. */
export function seatDetail(ticket: SeatedLabel): string {
  const seat = ticket.seatInfo;
  if (ticket.isSeated && seat?.rowLabel && seat.seatNumber) {
    return `Hàng ${seat.rowLabel}, ghế ${seat.seatNumber}`;
  }
  return seat?.formattedLabel ?? "";
}

const bySeat = new Intl.Collator("vi", { numeric: true });

/** Vé hiện trên thẻ chính theo thứ tự ghế; vé đã hủy chỉ ghi trong chi tiết. */
export function listedTickets<T extends { status: string } & SeatedLabel>(
  order: OrderForView<T>,
): T[] {
  return order.tickets
    .filter((t) => t.status !== "CANCELLED")
    .sort((a, b) => bySeat.compare(seatDetail(a), seatDetail(b)));
}

/** Gộp các dòng cùng hạng vé, cùng đơn giá (mỗi ghế là một dòng trong đơn). */
export function groupOrderItems(
  items: {
    ticketTypeId: string;
    ticketTypeName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }[],
) {
  const groups = new Map<
    string,
    { key: string; name: string; quantity: number; subtotal: number }
  >();
  for (const item of items) {
    const key = `${item.ticketTypeId}:${item.unitPrice}`;
    const group = groups.get(key);
    if (group) {
      group.quantity += item.quantity;
      group.subtotal += item.subtotal;
    } else {
      groups.set(key, {
        key,
        name: item.ticketTypeName,
        quantity: item.quantity,
        subtotal: item.subtotal,
      });
    }
  }
  return [...groups.values()];
}
