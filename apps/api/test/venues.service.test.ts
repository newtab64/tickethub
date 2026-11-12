import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createVenueServices } from "../src/contexts/venue/venue.composition";
import { VenueDomainError } from "../src/contexts/venue/domain/venue.errors";
import { InMemoryVenueRepository } from "./helpers/in-memory-venue.repository";
import type Redis from "ioredis";
import type { CreateVenueLayoutDto } from "@tickethub/shared";

describe("VenuesService Unit Tests", () => {
  let mockRedis: {
    get: (key: string) => Promise<string | null>;
    set: (
      key: string,
      value: string,
      mode?: string,
      duration?: number,
    ) => Promise<string>;
    del: (...keys: string[]) => Promise<number>;
    keys: (pattern: string) => Promise<string[]>;
  };
  let cacheStore: Map<string, string>;
  let repo: InMemoryVenueRepository;
  let service: ReturnType<typeof createVenueServices>;

  beforeEach(() => {
    cacheStore = new Map<string, string>();
    mockRedis = {
      get: async (key: string) => cacheStore.get(key) || null,
      set: async (key: string, value: string) => {
        cacheStore.set(key, value);
        return "OK";
      },
      del: async (...keys: string[]) => {
        let count = 0;
        for (const k of keys) {
          if (cacheStore.delete(k)) count++;
        }
        return count;
      },
      keys: async (pattern: string) => {
        const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        return Array.from(cacheStore.keys()).filter((k) => regex.test(k));
      },
    };

    repo = new InMemoryVenueRepository();
    service = createVenueServices(mockRedis as unknown as Redis, { repo });
  });

  it("should return cached venue layouts when cache hit occurs", async () => {
    const venueId = "venue-123";
    const cachedData = [
      {
        id: "layout-1",
        venueId,
        name: "Sân khấu Chữ T",
        categoryName: "Live Concert",
        capacityEstimate: "20,000",
        mapKey: "test-map",
        svgContent: "<svg></svg>",
        defaultZones: [],
        isDefault: true,
      },
    ];

    cacheStore.set(`venue:layouts:${venueId}`, JSON.stringify(cachedData));

    const result = await service.queries.getVenueLayouts(venueId);
    assert.deepEqual(result, cachedData);
  });

  it("should invalidate redis cache when venue layout is created", async () => {
    const venueId = "venue-456";
    cacheStore.set(`venue:layouts:${venueId}`, JSON.stringify([]));
    cacheStore.set("venues:list:all", JSON.stringify([]));

    const newLayout: CreateVenueLayoutDto = {
      name: "Sơ đồ mới",
      categoryName: "Concert",
      capacityEstimate: "15,000",
      mapKey: "map-new",
      defaultZones: [],
      isDefault: false,
    };

    await service.commands.createVenueLayout(venueId, newLayout);

    assert.equal(cacheStore.has(`venue:layouts:${venueId}`), false);
    assert.equal(cacheStore.has("venues:list:all"), false);
  });

  it("should invalidate redis cache when venue is updated", async () => {
    cacheStore.set("venues:list:page1", JSON.stringify([]));

    const venue = await repo.create({
      name: "Default",
      shortName: "DEF",
      city: "Hà Nội",
      district: "Ba Đình",
      address: "123 Đường",
      category: "stadium",
      totalCapacity: "30,000",
    });
    cacheStore.set(`venue:detail:${venue.id}`, JSON.stringify({}));

    await service.commands.updateVenue(venue.id, { name: "Tên Mới" });

    assert.equal(cacheStore.has(`venue:detail:${venue.id}`), false);
    assert.equal(cacheStore.has("venues:list:page1"), false);
  });

  it("throws a domain error when updating a venue that does not exist", async () => {
    await assert.rejects(
      () => service.commands.updateVenue("missing", { name: "x" }),
      (err: unknown) =>
        err instanceof VenueDomainError && err.code === "VENUE_NOT_FOUND",
    );
  });
});
