import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { VENUE_SVG } from "../src/lib/venue-svg.generated.ts";
import {
  NEW_VENUE_MAP_KEYS,
  EVENT_MAP_OVERRIDES,
  NEW_MAP_TIERS,
  resolveNewMapKey,
  extractZones,
  buildZoneListings,
} from "../src/lib/venue-zones.ts";
import {
  shouldShowMinimap,
  VENUE_MAP_CAPACITY,
  LARGE_VENUE_CAPACITY,
  parseViewBox,
} from "../src/components/events/seat-map.utils.ts";

const WEB_ROOT = path.resolve(import.meta.dirname, "..");
const publicFile = (url: string) => path.join(WEB_ROOT, "public", url);

const OLD_KEYS = [
  "arena-t-stage",
  "stadium-concert",
  "stadium-football",
  "arena-basketball",
  "theater",
];

// Doc id su kien tu file catalog (khong import catalog vi file do co import runtime khong co duoi .ts)
const catalogSource = fs.readFileSync(
  path.join(WEB_ROOT, "src/lib/events-catalog.ts"),
  "utf8",
);
const ALL_EVENT_IDS = [...catalogSource.matchAll(/^\s+id: "(evt-[^"]+)"/gm)].map(
  (m) => m[1],
);

describe("Venue maps: 6 so do moi cho 6 su kien", () => {
  test("co dung 6 map moi, khong lam mat 5 map cu", () => {
    assert.equal(NEW_VENUE_MAP_KEYS.length, 6);
    assert.equal(new Set(NEW_VENUE_MAP_KEYS).size, 6);
    for (const key of [...OLD_KEYS, ...NEW_VENUE_MAP_KEYS]) {
      assert.ok(key in VENUE_SVG, `Thieu map ${key} trong VENUE_SVG`);
    }
    assert.equal(Object.keys(VENUE_SVG).length, 11);
  });

  for (const key of NEW_VENUE_MAP_KEYS) {
    describe(`map ${key}`, () => {
      const map = VENUE_SVG[key];
      const zones = extractZones(map.markup);

      test("viewBox hop le (4 so, rong va cao duong)", () => {
        const vb = parseViewBox(map.viewBox);
        assert.ok(vb, "viewBox phai parse duoc");
        assert.ok(vb.width > 0 && vb.height > 0);
      });

      test("data-zone khong trung va so khu du lon", () => {
        const groups = map.markup.match(/<g data-zone="[^"]+"/g) ?? [];
        const ids = groups.map((g) => g.match(/data-zone="([^"]+)"/)![1]);
        assert.equal(new Set(ids).size, ids.length, "Co data-zone bi trung");
        assert.equal(zones.length, ids.length, "extractZones bo sot khu");
        const min = key === "mega-festival" ? 90 : 6;
        assert.ok(zones.length >= min, `${key} chi co ${zones.length} khu`);
      });

      test("moi khu thuoc mot tang co cau hinh, khong co tang mo coi", () => {
        const tiers = NEW_MAP_TIERS[key];
        for (const z of zones) {
          assert.ok(tiers[z.tier], `Khu ${z.zoneId} co tang la ${z.tier}`);
        }
        const used = new Set(zones.map((z) => z.tier));
        for (const tier of Object.keys(tiers)) {
          assert.ok(used.has(tier), `Tang ${tier} khong co khu nao`);
        }
      });

      test("moi tang co anh goc nhin ton tai tren dia", () => {
        for (const [tier, cfg] of Object.entries(NEW_MAP_TIERS[key])) {
          assert.ok(
            fs.existsSync(publicFile(cfg.viewImage)),
            `Thieu anh ${cfg.viewImage} (tang ${tier})`,
          );
          assert.ok(cfg.priceMult > 0);
        }
      });
    });
  }

  test("5 su kien rieng + 1 su kien mega dung dung map moi", () => {
    assert.deepEqual(EVENT_MAP_OVERRIDES, {
      "evt-nhung-thanh-pho-mo-mang": "mega-festival",
      "evt-anh-trai-vuot-ngan-chong-gai": "concert-open-air",
      "evt-ha-anh-tuan-sketch-a-rose": "theater-hoa-binh",
      "evt-vleague-cahn-namdinh": "football-hang-day",
      "evt-vba-finals-saigon-heat": "basketball-saigon-heat",
      "evt-giao-huong-ghibli-hanoi": "opera-nha-hat-lon",
    });
    for (const [eventId, mapKey] of Object.entries(EVENT_MAP_OVERRIDES)) {
      assert.ok(ALL_EVENT_IDS.includes(eventId), `Khong co su kien ${eventId}`);
      assert.equal(resolveNewMapKey(eventId), mapKey);
    }
  });

  test("cac su kien con lai khong bi doi map (chong hoi quy)", () => {
    assert.equal(ALL_EVENT_IDS.length, 20);
    const others = ALL_EVENT_IDS.filter((id) => !(id in EVENT_MAP_OVERRIDES));
    assert.equal(others.length, 14);
    for (const id of others) {
      assert.equal(resolveNewMapKey(id), null, `${id} khong duoc co map moi`);
    }
  });
});

describe("Venue maps: danh sach ve sinh tu cau hinh khu", () => {
  for (const [eventId, mapKey] of Object.entries(EVENT_MAP_OVERRIDES)) {
    describe(`${eventId} -> ${mapKey}`, () => {
      const event = { id: eventId, minPriceNumber: 800000 };
      const markup = VENUE_SVG[mapKey as keyof typeof VENUE_SVG].markup;
      const listings = buildZoneListings(event, mapKey, markup);
      const zoneIds = new Set(extractZones(markup).map((z) => z.zoneId));

      test("co ve ban, id duy nhat, du lieu hop le", () => {
        assert.ok(listings.length >= 3, `Chi co ${listings.length} listing`);
        assert.equal(
          new Set(listings.map((l) => l.id)).size,
          listings.length,
          "listing id bi trung",
        );
        for (const l of listings) {
          assert.equal(l.eventId, eventId);
          assert.ok(Number.isInteger(l.price) && l.price > 0);
          assert.equal(l.price % 10000, 0, "gia phai tron 10.000");
          assert.ok(Number.isInteger(l.availableTickets) && l.availableTickets >= 1);
          assert.ok(l.dealScore >= 1 && l.dealScore <= 10);
        }
      });

      test("moi listing tro ve mot khu co that tren so do + anh ton tai", () => {
        for (const l of listings) {
          assert.ok(zoneIds.has(l.zoneId), `Listing tro ve khu ${l.zoneId} khong co tren map`);
          assert.ok(
            fs.existsSync(publicFile(l.viewFromSeatUrl)),
            `Thieu anh ${l.viewFromSeatUrl}`,
          );
        }
      });

      test("on dinh: goi hai lan cho ket qua giong het", () => {
        assert.deepEqual(buildZoneListings(event, mapKey, markup), listings);
      });
    });
  }

  test("gia ve tang theo gia goc cua su kien", () => {
    const mapKey = "theater-hoa-binh";
    const markup = VENUE_SVG[mapKey].markup;
    const low = buildZoneListings({ id: "e1", minPriceNumber: 500000 }, mapKey, markup);
    const high = buildZoneListings({ id: "e1", minPriceNumber: 1000000 }, mapKey, markup);
    assert.equal(low.length, high.length);
    for (let i = 0; i < low.length; i++) assert.ok(high[i].price > low[i].price);
  });
});

describe("Minimap: bat theo quy mo suc chua cua map", () => {
  test("moi map deu co suc chua khai bao", () => {
    for (const key of Object.keys(VENUE_SVG)) {
      assert.ok(
        Number.isFinite(VENUE_MAP_CAPACITY[key]) && VENUE_MAP_CAPACITY[key] > 0,
        `Thieu suc chua cho map ${key}`,
      );
    }
  });

  test("map lon (>= nguong) hien minimap ngay tu zoom 1", () => {
    assert.equal(LARGE_VENUE_CAPACITY, 20000);
    for (const key of [
      "mega-festival",
      "stadium-concert",
      "stadium-football",
      "football-hang-day",
    ]) {
      assert.equal(shouldShowMinimap(key, 1), true, key);
    }
  });

  test("map vua va nho chi hien minimap khi phong to > 1.25", () => {
    for (const key of [
      "arena-t-stage",
      "arena-basketball",
      "theater",
      "concert-open-air",
      "theater-hoa-binh",
      "basketball-saigon-heat",
      "opera-nha-hat-lon",
    ]) {
      assert.equal(shouldShowMinimap(key, 1), false, `${key} zoom 1`);
      assert.equal(shouldShowMinimap(key, 1.25), false, `${key} zoom 1.25`);
      assert.equal(shouldShowMinimap(key, 1.5), true, `${key} zoom 1.5`);
    }
  });

  test("map khong ro thi mac dinh an minimap o zoom 1", () => {
    assert.equal(shouldShowMinimap(undefined, 1), false);
    assert.equal(shouldShowMinimap("khong-ton-tai", 1), false);
  });
});
