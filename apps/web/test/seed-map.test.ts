import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  SAMPLE_EVENT_MAP,
  SEED_EVENTS,
} from "../../api/src/database/catalog-data.ts";
import { VENUE_SVG } from "../src/features/venue/data/venue-svg.generated.ts";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public");

const hasZone = (mapKey: string, zone: string) =>
  VENUE_SVG[mapKey as keyof typeof VENUE_SVG]?.markup.includes(
    `data-zone="${zone}"`,
  ) ?? false;

describe("Seed: anh xa so do khu vuc", () => {
  test("8 su kien moi, du 3 the loai, slug khong trung, dien sau su kien mau", () => {
    assert.equal(SEED_EVENTS.length, 8);
    assert.deepEqual(
      [...new Set(SEED_EVENTS.map((e) => e.category))].sort(),
      ["Sân khấu & Nghệ thuật", "Thể thao", "Âm nhạc"].sort(),
    );
    const slugs = [SAMPLE_EVENT_MAP.slug, ...SEED_EVENTS.map((e) => e.slug)];
    assert.equal(new Set(slugs).size, slugs.length);
    // E2E W04 lay su kien som nhat, phai van la su kien mau (14 ngay).
    assert.ok(SEED_EVENTS.every((e) => e.daysFromNow >= 21));
    assert.equal(SEED_EVENTS.filter((e) => e.mapKey === null).length, 1);
  });

  test("moi mapZone ton tai trong dung so do", () => {
    for (const event of SEED_EVENTS) {
      assert.ok(event.ticketTypes.length >= 2, event.slug);
      for (const type of event.ticketTypes) {
        assert.ok(type.capacity > 0 && type.capacity <= 200, event.slug);
        if (event.mapKey === null) {
          assert.equal(type.mapZone, null, event.slug);
        } else if (type.mapZone !== null) {
          assert.ok(
            hasZone(event.mapKey, type.mapZone),
            `${event.slug}: ${event.mapKey}/${type.mapZone}`,
          );
        }
      }
    }
    for (const zone of Object.values(SAMPLE_EVENT_MAP.zones)) {
      assert.ok(hasZone(SAMPLE_EVENT_MAP.mapKey, zone), zone);
    }
  });

  test("moi anh banner co trong thu muc public", () => {
    for (const url of [
      SAMPLE_EVENT_MAP.bannerUrl,
      ...SEED_EVENTS.map((e) => e.bannerUrl),
    ]) {
      assert.ok(existsSync(path.join(PUBLIC_DIR, url)), url);
    }
  });
});
