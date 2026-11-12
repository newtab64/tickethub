import type {
  EventSearchItem,
  SearchCursor,
  SearchFilters,
} from "./search.models";

export interface EventSearchRepository {
  /** Tra ve null neu su kien khong ton tai hoac chua PUBLISHED. */
  resolveCursor(eventId: string): Promise<SearchCursor | null>;
  /** ID su kien khop bo loc, theo thu tu on dinh (startTime, id), toi da `take`. */
  findMatchingIds(
    filters: SearchFilters,
    cursor: SearchCursor | null,
    take: number,
  ): Promise<string[]>;
  /** Chi tiet kem hang ve; thu tu khong dam bao. */
  loadDetails(ids: string[]): Promise<EventSearchItem[]>;
}
