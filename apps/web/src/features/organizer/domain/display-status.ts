import { EventStatus } from "@tickethub/shared";
import type { OrganizerEventItem } from "./organizer.types";

// TODO(contract): API lacks SOLD_OUT and ALMOST_SOLD_OUT enum values; derived in frontend selector
export interface DisplayStatusMeta {
  key: string;
  label: string;
  badgeClass: string;
}

export function getDisplayStatus(event: OrganizerEventItem): DisplayStatusMeta {
  if (event.status === EventStatus.PUBLISHED) {
    if (event.ticketsTotal > 0 && event.ticketsSold >= event.ticketsTotal) {
      return {
        key: "SOLD_OUT",
        label: "Hết vé",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      };
    }
    if (
      event.ticketsTotal > 0 &&
      event.ticketsSold >= event.ticketsTotal * 0.9
    ) {
      return {
        key: "ALMOST_SOLD_OUT",
        label: "Sắp hết vé",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      };
    }
  }

  switch (event.status) {
    case EventStatus.PUBLISHED:
      return {
        key: EventStatus.PUBLISHED,
        label: "Đang mở bán",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case EventStatus.DRAFT:
      return {
        key: EventStatus.DRAFT,
        label: "Bản nháp",
        badgeClass: "bg-secondary text-muted-foreground border-border",
      };
    case EventStatus.PENDING_APPROVAL:
      return {
        key: EventStatus.PENDING_APPROVAL,
        label: "Chờ duyệt",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case EventStatus.SUSPENDED:
      return {
        key: EventStatus.SUSPENDED,
        label: "Tạm dừng",
        badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
      };
    case EventStatus.ENDED:
      return {
        key: EventStatus.ENDED,
        label: "Đã kết thúc",
        badgeClass: "bg-muted text-muted-foreground border-border",
      };
    case EventStatus.CANCELLED:
      return {
        key: EventStatus.CANCELLED,
        label: "Đã hủy",
        badgeClass: "bg-red-50 text-destructive border-red-200",
      };
    default:
      return {
        key: "UNKNOWN",
        label: event.status,
        badgeClass: "bg-secondary text-muted-foreground border-border",
      };
  }
}
