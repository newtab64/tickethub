import type { MyTicketItem } from "@tickethub/shared";

export const QR_ROTATION_SECONDS = 30;

export type TicketFilterTab = "ALL" | "ISSUED" | "CHECKED_IN" | "CANCELLED";

export interface BoardingPassTicketView {
  ticketId: string;
  ticketCode: string;
  orderCode: string;
  eventId: string;
  eventTitle: string;
  eventImage: string;
  fullDateTime: string;
  venue: string;
  city: string;
  zoneName: string;
  rowLabel: string;
  seatNumbers: string;
  quantity: number;
  totalPrice: number;
  status: "ISSUED" | "CHECKED_IN" | "CANCELLED";
  isFromApi: boolean;
}

export function formatTicketVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function normalizeTicketStatus(
  status: string,
): "ISSUED" | "CHECKED_IN" | "CANCELLED" {
  if (status === "CHECKED_IN") return "CHECKED_IN";
  if (status === "CANCELLED" || status === "REFUNDED") return "CANCELLED";
  return "ISSUED";
}

export function mapApiTicketToView(
  item: MyTicketItem,
  fallbackImage: string,
): BoardingPassTicketView {
  const seatText =
    item.seatInfo?.formattedLabel ||
    item.seatInfo?.seatNumber ||
    "Khu đứng tự do";

  return {
    ticketId: item.id,
    ticketCode: item.ticketCode,
    orderCode: item.orderCode,
    eventId: item.eventId,
    eventTitle: item.eventTitle,
    eventImage: item.eventBannerUrl || fallbackImage,
    fullDateTime: item.eventStartTime,
    venue: item.eventVenueName || "Đang cập nhật địa điểm",
    city: item.eventCity || "",
    zoneName: item.seatInfo?.zoneName || item.ticketTypeName,
    rowLabel: item.seatInfo?.rowLabel || "Khu vực chung",
    seatNumbers: seatText,
    quantity: 1,
    totalPrice: item.effectivePaidPrice || item.price,
    status: normalizeTicketStatus(item.status),
    isFromApi: true,
  };
}

export function filterTicketsByTab(
  tickets: BoardingPassTicketView[],
  tab: TicketFilterTab,
): BoardingPassTicketView[] {
  if (tab === "ALL") return tickets;
  return tickets.filter((t) => t.status === tab);
}

export function buildTicketFallbackQrPayload(
  ticket: BoardingPassTicketView,
  rotationTick: number,
  nowEpochMs: number = Date.now(),
): string {
  return JSON.stringify({
    v: 1,
    ticketId: ticket.ticketId,
    ticketCode: ticket.ticketCode,
    order: ticket.orderCode,
    event: ticket.eventId,
    zone: ticket.zoneName,
    seats: ticket.seatNumbers,
    tick: rotationTick,
    exp: nowEpochMs + QR_ROTATION_SECONDS * 1000,
  });
}
