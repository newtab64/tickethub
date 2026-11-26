import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VenuesController } from "../src/contexts/venue/interface/venues.controller";
import { AdminVenuesController } from "../src/contexts/venue/interface/admin-venues.controller";
import { createVenueServices } from "../src/contexts/venue/venue.composition";
import { InMemoryVenueRepository } from "./helpers/in-memory-venue.repository";
import type Redis from "ioredis";

describe("Venues Integration Flow Simulation", () => {
  it("allows Admin to create venue and layout, and Public to search and view layouts", async () => {
    const cacheStore = new Map<string, string>();

    const mockRedis = {
      get: async (key: string) => cacheStore.get(key) || null,
      set: async (key: string, value: string) => {
        cacheStore.set(key, value);
        return "OK";
      },
      del: async (...keys: string[]) => {
        for (const k of keys) cacheStore.delete(k);
        return keys.length;
      },
      keys: async (pattern: string) => {
        const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        return Array.from(cacheStore.keys()).filter((k) => regex.test(k));
      },
    } as unknown as Redis;

    const { queries, commands } = createVenueServices(mockRedis, {
      repo: new InMemoryVenueRepository(),
    });
    const publicController = new VenuesController(queries);
    const adminController = new AdminVenuesController(commands);

    // 1. Admin creates Curated Venue: SVĐ Mỹ Đình
    const createVenueRes = await adminController.createVenue({
      name: "Sân vận động Quốc gia Mỹ Đình",
      shortName: "SVĐ Mỹ Đình",
      city: "Hà Nội",
      district: "Nam Từ Liêm",
      address: "Đường Lê Đức Thọ, Phường Mỹ Đình 1, Nam Từ Liêm, Hà Nội",
      category: "stadium",
      totalCapacity: "40,000+",
      thumbnailUrl: "/images/venues/my-dinh.webp",
      description: "Sân vận động quốc gia hàng đầu tại Hà Nội",
    });

    assert.equal(createVenueRes.success, true);
    const venueId = createVenueRes.data.id;

    // 2. Admin adds SVG Layout
    const createLayoutRes = await adminController.createVenueLayout(venueId, {
      name: "Sân Khấu Chữ T (Live Concert T-Stage)",
      categoryName: "Live Concert",
      capacityEstimate: "25,000 - 30,000",
      mapKey: "my-dinh-concert-t-stage",
      svgContent: '<svg viewBox="0 0 1000 800"><g id="stage"></g></svg>',
      defaultZones: [
        {
          zoneName: "VVIP Khán Đài A",
          color: "#E5A93C",
          price: 3500000,
          capacity: 1500,
        },
      ],
      isDefault: true,
    });

    assert.equal(createLayoutRes.success, true);
    assert.equal(createLayoutRes.data.mapKey, "my-dinh-concert-t-stage");

    // 3. Organizer / Public searches venues by city
    const haNoiVenues = await publicController.getVenues({ city: "Hà Nội" });
    assert.equal(haNoiVenues.success, true);
    assert.equal(haNoiVenues.data.items.length, 1);
    assert.equal(haNoiVenues.data.items[0]?.layoutsCount, 1);

    // 4. Search with non-matching city returns 0
    const hcmVenues = await publicController.getVenues({
      city: "TP. Hồ Chí Minh",
    });
    assert.equal(hcmVenues.success, true);
    assert.equal(hcmVenues.data.items.length, 0);

    // 5. Query layout details for event setup
    const layoutsRes = await publicController.getVenueLayouts(venueId);
    assert.equal(layoutsRes.success, true);
    assert.equal(layoutsRes.data.length, 1);
    assert.equal(
      layoutsRes.data[0]?.defaultZones[0]?.zoneName,
      "VVIP Khán Đài A",
    );
  });
});
