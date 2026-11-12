import { InvalidSearchCursorError } from "../domain/search.errors";
import type {
  EventSearchResult,
  SearchCursor,
  SearchFilters,
} from "../domain/search.models";
import type { EventSearchRepository } from "../domain/search.ports";

/** Tim kiem su kien da cong bo, phan trang bang cursor on dinh. */
export class SearchEventsUseCase {
  constructor(private readonly repo: EventSearchRepository) {}

  async execute(filters: SearchFilters): Promise<EventSearchResult> {
    let cursor: SearchCursor | null = null;
    if (filters.cursor) {
      cursor = await this.repo.resolveCursor(filters.cursor);
      if (!cursor) throw new InvalidSearchCursorError();
    }

    const ids = await this.repo.findMatchingIds(
      filters,
      cursor,
      filters.limit + 1,
    );
    const hasMore = ids.length > filters.limit;
    const pageIds = ids.slice(0, filters.limit);

    if (pageIds.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const details = await this.repo.loadDetails(pageIds);
    const byId = new Map(details.map((event) => [event.id, event]));
    const items = pageIds
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    return {
      items,
      nextCursor: hasMore ? pageIds[pageIds.length - 1]! : null,
      hasMore,
    };
  }
}
