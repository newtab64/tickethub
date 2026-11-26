import type {
  CreateVenueDto,
  CreateVenueLayoutDto,
  UpdateVenueDto,
  Venue,
  VenueFilters,
  VenueLayout,
  VenuePage,
} from "../../src/contexts/venue/domain/venue.models";
import type { VenueRepository } from "../../src/contexts/venue/domain/venue.ports";

/** Cai dat trong bo nho cua cong VenueRepository, dung cho test ung dung. */
export class InMemoryVenueRepository implements VenueRepository {
  readonly venues: Venue[] = [];
  readonly layouts: VenueLayout[] = [];

  async search(
    filters: VenueFilters,
    page: number,
    limit: number,
  ): Promise<VenuePage> {
    let rows = this.venues.filter((v) => v.isActive);
    if (filters.city) rows = rows.filter((v) => v.city === filters.city);
    if (filters.category) {
      rows = rows.filter((v) => v.category === filters.category);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.shortName.toLowerCase().includes(q) ||
          v.district.toLowerCase().includes(q),
      );
    }
    const items = rows.slice((page - 1) * limit, page * limit).map((v) => ({
      ...v,
      layoutsCount: this.layouts.filter((l) => l.venueId === v.id && l.isActive)
        .length,
    }));
    return { items, total: rows.length, page, limit };
  }

  async findActiveById(id: string) {
    return this.venues.find((v) => v.id === id && v.isActive) ?? null;
  }

  async listActiveLayouts(venueId: string) {
    return this.layouts.filter((l) => l.venueId === venueId && l.isActive);
  }

  async create(dto: CreateVenueDto): Promise<Venue> {
    const venue: Venue = {
      id: `v-${this.venues.length + 1}`,
      ...dto,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      description: dto.description ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.venues.push(venue);
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue | null> {
    const venue = this.venues.find((v) => v.id === id);
    if (!venue) return null;
    Object.assign(venue, dto, { updatedAt: new Date() });
    return venue;
  }

  async addLayout(
    venueId: string,
    dto: CreateVenueLayoutDto,
  ): Promise<VenueLayout> {
    if (dto.isDefault) {
      for (const l of this.layouts) {
        if (l.venueId === venueId) l.isDefault = false;
      }
    }
    const layout: VenueLayout = {
      id: `layout-${this.layouts.length + 1}`,
      venueId,
      name: dto.name,
      categoryName: dto.categoryName,
      description: dto.description ?? null,
      capacityEstimate: dto.capacityEstimate,
      mapKey: dto.mapKey,
      svgContent: dto.svgContent ?? null,
      defaultZones: dto.defaultZones,
      isDefault: dto.isDefault ?? false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.layouts.push(layout);
    return layout;
  }
}
