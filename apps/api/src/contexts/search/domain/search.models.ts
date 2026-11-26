import type { SearchQuery } from "@tickethub/shared";

export type SearchFilters = SearchQuery;

/** Moc phan trang theo (startTime, id) cua mot su kien da cong bo. */
export interface SearchCursor {
  id: string;
  startTime: Date;
}

/** Su kien trong ket qua tim kiem kem cac hang ve (hinh dang giong API cong khai). */
export type EventSearchItem = { id: string } & Record<string, unknown>;

export interface EventSearchResult {
  items: EventSearchItem[];
  nextCursor: string | null;
  hasMore: boolean;
}
