import type { PublicEvent } from "@tickethub/shared";
import type { VenueMapKey } from "@/features/venue";
import type { TicketListing } from "./event.types";

// Record buoc danh sach khop dung tap khoa cua VENUE_SVG.
const VENUE_MAP_KEYS: Record<VenueMapKey, true> = {
  "arena-t-stage": true,
  "stadium-concert": true,
  "stadium-football": true,
  "arena-basketball": true,
  theater: true,
};

/** Khoa so do cua su kien; null (khong hien so do) khi thieu hoac khong biet. */
export function eventMapKey(event: PublicEvent): VenueMapKey | null {
  return event.mapKey && Object.hasOwn(VENUE_MAP_KEYS, event.mapKey)
    ? (event.mapKey as VenueMapKey)
    : null;
}

export function toTicketListings(
  event: PublicEvent,
  now: number,
): TicketListing[] {
  return event.ticketTypes.map((type) => ({
    id: type.id,
    eventId: event.id,
    zoneId: type.mapZone ?? "",
    zoneName: type.name,
    price: type.price,
    availableTickets: Math.max(
      0,
      type.capacity - type.heldCount - type.soldCount,
    ),
    maxPerOrder: type.maxPerOrder,
    onSale:
      now >= Date.parse(type.saleStartTime) &&
      now < Date.parse(type.saleEndTime),
    isStanding: !type.isSeated,
  }));
}
