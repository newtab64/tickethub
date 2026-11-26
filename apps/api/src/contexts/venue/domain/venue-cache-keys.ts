import type { VenueFilters } from "./venue.models";

export const VENUE_CACHE_TTL = {
  list: 3600,
  detail: 3600,
  layouts: 86400,
} as const;

export const venueCacheKeys = {
  list: (filters: VenueFilters, page: number, limit: number) =>
    `venues:list:${JSON.stringify({ ...filters, page, limit })}`,
  detail: (id: string) => `venue:detail:${id}`,
  layouts: (id: string) => `venue:layouts:${id}`,
  listPattern: "venues:list:*",
} as const;
