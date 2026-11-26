import { SearchEventsUseCase } from "./application/search-events.use-case";
import type { EventSearchRepository } from "./domain/search.ports";
import { DrizzleEventSearchRepository } from "./infrastructure/drizzle-event-search.repository";

export function createSearchEventsUseCase(repo?: EventSearchRepository) {
  return new SearchEventsUseCase(repo ?? new DrizzleEventSearchRepository());
}
