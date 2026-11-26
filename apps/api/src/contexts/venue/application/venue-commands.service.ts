import type {
  CreateVenueDto,
  CreateVenueLayoutDto,
  UpdateVenueDto,
  Venue,
  VenueLayout,
} from "../domain/venue.models";
import { venueErrors } from "../domain/venue.errors";
import type { VenueReadCache, VenueRepository } from "../domain/venue.ports";

/** Lenh ghi (Admin) cho context Venue; moi lenh xoa cache sau khi ghi. */
export class VenueCommands {
  constructor(
    private readonly repo: VenueRepository,
    private readonly cache: VenueReadCache,
  ) {}

  async createVenue(dto: CreateVenueDto): Promise<Venue> {
    const venue = await this.repo.create(dto);
    await this.cache.invalidate();
    return venue;
  }

  async updateVenue(id: string, dto: UpdateVenueDto): Promise<Venue> {
    const updated = await this.repo.update(id, dto);
    if (!updated) throw venueErrors.notFoundForUpdate();
    await this.cache.invalidate(id);
    return updated;
  }

  async createVenueLayout(
    venueId: string,
    dto: CreateVenueLayoutDto,
  ): Promise<VenueLayout> {
    const layout = await this.repo.addLayout(venueId, dto);
    await this.cache.invalidate(venueId);
    return layout;
  }
}
