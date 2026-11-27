export const QR_SOON_SECONDS = 5;

/** Chi ve con hieu luc cua su kien dang mo moi xin duoc ma QR. */
export function canShowQr(
  ticket: { status: string },
  eventStatus: string,
): boolean {
  return ticket.status === "SOLD" && eventStatus === "PUBLISHED";
}

/** So giay con lai, tinh tu luc nhan ma nen khong phu thuoc gio may chu. */
export function qrSecondsLeft(
  receivedAt: number,
  remainingSeconds: number,
  now: number,
): number {
  const left = Math.ceil(remainingSeconds - (now - receivedAt) / 1000);
  return Math.min(remainingSeconds, Math.max(0, left));
}

/** May chu tu choi cap ma (khac voi loi tam thoi co the thu lai). */
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
}

/** Viec chinh cua trang don: tra tien, hien ma vao cong, hoac khong co. */
export function primaryAction(
  order: OrderForView<{ status: string }>,
): "pay" | "qr" | "none" {
  if (order.status === "PENDING") return "pay";
  return order.tickets.some((t) => canShowQr(t, order.event.status))
    ? "qr"
    : "none";
}

export function noQrReason(
  order: OrderForView<{ status: string }>,
): string | null {
  if (primaryAction(order) !== "none") return null;
  if (order.tickets.length === 0) {
    return order.status === "PAID"
      ? "Vé sẽ xuất hiện sau khi hệ thống xác nhận thanh toán thành công."
      : "Đơn này không có vé.";
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

/** Dong phu cua ve: hang va ghe; ve dung giu nguyen nhan cua backend. */
export function seatDetail(ticket: SeatedLabel): string {
  const seat = ticket.seatInfo;
  if (ticket.isSeated && seat?.rowLabel && seat.seatNumber) {
    return `Hàng ${seat.rowLabel}, ghế ${seat.seatNumber}`;
  }
  return seat?.formattedLabel ?? "";
}

const bySeat = new Intl.Collator("vi", { numeric: true });

/** Ve hien tren the chinh theo thu tu ghe; ve da huy chi ghi trong chi tiet. */
export function listedTickets<T extends { status: string } & SeatedLabel>(
  order: OrderForView<T>,
): T[] {
  return order.tickets
    .filter((t) => t.status !== "CANCELLED")
    .sort((a, b) => bySeat.compare(seatDetail(a), seatDetail(b)));
}

/** Gop cac dong cung hang ve, cung don gia (moi ghe la mot dong trong don). */
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
