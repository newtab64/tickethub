import type {
  VenueDetail,
  VenueFilters,
  VenueLayout,
  VenuePage,
} from "../domain/venue.models";
import { venueErrors } from "../domain/venue.errors";
import type { VenueReadCache, VenueRepository } from "../domain/venue.ports";
import { VENUE_CACHE_TTL, venueCacheKeys } from "../domain/venue-cache-keys";

/** Truy van (doc) co cache cho context Venue. */
export class VenueQueries {
  constructor(
    private readonly repo: VenueRepository,
    private readonly cache: VenueReadCache,
  ) {}

  async getVenues(filters: VenueFilters): Promise<VenuePage> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const key = venueCacheKeys.list(filters, page, limit);

    const cached = await this.cache.get<VenuePage>(key);
    if (cached) return cached;

    const result = await this.repo.search(filters, page, limit);
    await this.cache.set(key, result, VENUE_CACHE_TTL.list);
    return result;
  }

  async getVenueById(id: string): Promise<VenueDetail> {
    const key = venueCacheKeys.detail(id);
    const cached = await this.cache.get<VenueDetail>(key);
    if (cached) return cached;

    const venue = await this.repo.findActiveById(id);
    if (!venue) throw venueErrors.notFound();

    const layouts = await this.getVenueLayouts(id);
    const result: VenueDetail = { ...venue, layouts };
    await this.cache.set(key, result, VENUE_CACHE_TTL.detail);
    return result;
  }

  async getVenueLayouts(venueId: string): Promise<VenueLayout[]> {
    const key = venueCacheKeys.layouts(venueId);
    const cached = await this.cache.get<VenueLayout[]>(key);
    if (cached) return cached;

    const layouts = await this.repo.listActiveLayouts(venueId);
    await this.cache.set(key, layouts, VENUE_CACHE_TTL.layouts);
    return layouts;
  }
}
