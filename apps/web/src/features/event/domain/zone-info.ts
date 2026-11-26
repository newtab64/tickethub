import type { TicketListing } from "./event.types";

export interface ZoneInfo {
  name: string;
  minPrice: number;
  count: number;
}

/** Thong tin tung khu cho tooltip so do: gia thap nhat va tong so ve con lai. */
export function buildZoneInfoMap(
  listings: TicketListing[],
): Record<string, ZoneInfo> {
  const map: Record<string, ZoneInfo> = {};
  for (const listing of listings) {
    const zone = map[listing.zoneId];
    if (zone) {
      zone.minPrice = Math.min(zone.minPrice, listing.price);
      zone.count += listing.availableTickets;
    } else {
      map[listing.zoneId] = {
        name: listing.zoneName,
        minPrice: listing.price,
        count: listing.availableTickets,
      };
    }
  }
  return map;
}

/** Loc danh sach hang ve theo khu dang chon; khong chon khu thi giu nguyen. */
export function filterListingsByZone(
  listings: TicketListing[],
  activeZoneId: string | null,
): TicketListing[] {
  return listings.filter((l) => !(activeZoneId && l.zoneId !== activeZoneId));
}
