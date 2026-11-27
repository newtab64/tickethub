import type { PublicTicketType } from "@tickethub/shared";

const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatEventDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function remainingTickets(
  type: Pick<PublicTicketType, "capacity" | "heldCount" | "soldCount">,
): number {
  return Math.max(0, type.capacity - type.heldCount - type.soldCount);
}

export type AvailabilityLabel = "Hết vé" | "Sắp hết" | "Còn vé";

export function availabilityLabel(remaining: number): AvailabilityLabel {
  if (remaining <= 0) return "Hết vé";
  return remaining < 10 ? "Sắp hết" : "Còn vé";
}
