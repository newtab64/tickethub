import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../../../database/db";
import { venues } from "../../../database/schema/venues";
import { venueLayouts } from "../../../database/schema/venue-layouts";
import type {
  CreateVenueDto,
  CreateVenueLayoutDto,
  UpdateVenueDto,
  Venue,
  VenueFilters,
  VenueLayout,
  VenuePage,
  VenueZoneTemplate,
} from "../domain/venue.models";
import type { VenueRepository } from "../domain/venue.ports";

function toLayout(row: typeof venueLayouts.$inferSelect): VenueLayout {
  return { ...row, defaultZones: row.defaultZones as VenueZoneTemplate[] };
}

export class DrizzleVenueRepository implements VenueRepository {
  async search(
    filters: VenueFilters,
    page: number,
    limit: number,
  ): Promise<VenuePage> {
    const conditions = [eq(venues.isActive, true)];
    if (filters.city) conditions.push(eq(venues.city, filters.city));
    if (filters.category)
      conditions.push(eq(venues.category, filters.category));
    if (filters.search) {
      const pattern = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(venues.name, pattern),
          ilike(venues.shortName, pattern),
          ilike(venues.district, pattern),
          ilike(venues.address, pattern),
        )!,
      );
    }
    const where = and(...conditions);

    const items = await db
      .select()
      .from(venues)
      .where(where)
      .orderBy(desc(venues.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const countRows = await db
      .select({ totalCount: count() })
      .from(venues)
      .where(where);
    const total = Number(countRows[0]?.totalCount ?? 0);

    const layoutCounts = new Map<string, number>();
    if (items.length > 0) {
      const rows = await db
        .select({ venueId: venueLayouts.venueId, count: count() })
        .from(venueLayouts)
        .where(
          and(
            eq(venueLayouts.isActive, true),
            inArray(
              venueLayouts.venueId,
              items.map((v) => v.id),
            ),
          ),
        )
        .groupBy(venueLayouts.venueId);
      for (const row of rows) layoutCounts.set(row.venueId, Number(row.count));
    }

    return {
      items: items.map((item) => ({
        ...item,
        layoutsCount: layoutCounts.get(item.id) || 0,
      })),
      total,
      page,
      limit,
    };
  }

  async findActiveById(id: string): Promise<Venue | null> {
    const [venue] = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), eq(venues.isActive, true)))
      .limit(1);
    return venue ?? null;
  }

  async listActiveLayouts(venueId: string): Promise<VenueLayout[]> {
    const rows = await db
      .select()
      .from(venueLayouts)
      .where(
        and(eq(venueLayouts.venueId, venueId), eq(venueLayouts.isActive, true)),
      )
      .orderBy(desc(venueLayouts.isDefault), desc(venueLayouts.createdAt));
    return rows.map(toLayout);
  }

  async create(dto: CreateVenueDto): Promise<Venue> {
    const [venue] = await db
      .insert(venues)
      .values({
        name: dto.name,
        shortName: dto.shortName,
        city: dto.city,
        district: dto.district,
        address: dto.address,
        category: dto.category,
        totalCapacity: dto.totalCapacity,
        thumbnailUrl: dto.thumbnailUrl,
        description: dto.description,
      })
      .returning();
    return venue!;
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue | null> {
    const [updated] = await db
      .update(venues)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(venues.id, id))
      .returning();
    return updated ?? null;
  }

  async addLayout(
    venueId: string,
    dto: CreateVenueLayoutDto,
  ): Promise<VenueLayout> {
    if (dto.isDefault) {
      await db
        .update(venueLayouts)
        .set({ isDefault: false })
        .where(eq(venueLayouts.venueId, venueId));
    }
    const [layout] = await db
      .insert(venueLayouts)
      .values({
        venueId,
        name: dto.name,
        categoryName: dto.categoryName,
        description: dto.description,
        capacityEstimate: dto.capacityEstimate,
        mapKey: dto.mapKey,
        svgContent: dto.svgContent,
        defaultZones: dto.defaultZones,
        isDefault: dto.isDefault ?? false,
      })
      .returning();
    return toLayout(layout!);
  }
}
