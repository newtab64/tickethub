import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SeatStatus } from "@tickethub/shared";
import { VENUE_SVG, type VenueMapKey } from "../src/lib/venue-svg.generated.ts";
import {
  clampPanToMap,
  fitMapRect,
  parseViewBox,
  isValidTicketQuantity,
  isZoneAvailable,
  calculateOrderSubtotal,
  computeRemainingSeconds,
  getHoldErrorInfo,
} from "../src/components/events/seat-map.utils.ts";

describe("SeatMap: UC04 Architectural Map & Navigation", () => {
  test("SeatStatus enum tu shared package dung quy chuan", () => {
    assert.equal(SeatStatus.AVAILABLE, "AVAILABLE");
    assert.equal(SeatStatus.HELD, "HELD");
    assert.equal(SeatStatus.SOLD, "SOLD");
    assert.equal(SeatStatus.BLOCKED, "BLOCKED");
  });

  test("VENUE_SVG chua du 5 mau ban do khan dai khong trung lap cho 5 loai su kien", () => {
    const expectedZonesByMap: Record<VenueMapKey, string[]> = {
      "arena-t-stage": [
        "5715",
        "27859",
        "2196",
        "349",
        "495",
        "496",
        "497",
        "504",
      ],
      "stadium-concert": [
        "682",
        "101",
        "102",
        "105",
        "110",
        "112",
        "135",
        "138",
        "146",
        "406",
        "408",
        "410",
        "412",
        "438",
        "608",
        "610",
        "612",
        "638",
      ],
      "stadium-football": [
        "138",
        "140",
        "112",
        "114",
        "408",
        "410",
        "610",
        "612",
      ],
      "arena-basketball": [
        "19",
        "22",
        "C109",
        "C110",
        "105",
        "116",
        "120",
        "223",
      ],
      theater: ["vip", "orch", "box", "balc", "518", "519", "520", "521"],
    };

    const venueKeys = Object.keys(VENUE_SVG) as VenueMapKey[];
    assert.equal(
      venueKeys.length,
      5,
      "Phai co dung 5 mau seatmap cho 5 loai su kien khac nhau",
    );

    const seenMarkups = new Set<string>();
    const seenViewBoxes = new Set<string>();

    for (const [key, requiredZones] of Object.entries(expectedZonesByMap) as [
      VenueMapKey,
      string[],
    ][]) {
      const map = VENUE_SVG[key];
      assert.ok(map, `Ban do ${key} phai ton tai`);
      assert.ok(map.viewBox, `Ban do ${key} phai co viewBox`);
      assert.ok(
        map.markup.length > 5000,
        `Ban do ${key} phai co markup SVG kien truc chi tiet (> 5000 ky tu)`,
      );

      assert.equal(
        seenMarkups.has(map.markup),
        false,
        `Markup cua ${key} khong duoc trung lap voi mau seatmap khac`,
      );
      seenMarkups.add(map.markup);

      assert.equal(
        seenViewBoxes.has(map.viewBox),
        false,
        `viewBox cua ${key} khong duoc trung lap`,
      );
      seenViewBoxes.add(map.viewBox);

      const parsed = parseViewBox(map.viewBox);
      assert.ok(parsed.width > 0, `viewBox width cua ${key} phai > 0`);
      assert.ok(parsed.height > 0, `viewBox height cua ${key} phai > 0`);
      assert.ok(
        map.markup.includes("data-zone"),
        `Markup ${key} phai chua khu vuc data-zone`,
      );

      for (const zoneId of requiredZones) {
        assert.ok(
          map.markup.includes(`data-zone="${zoneId}"`),
          `Ban do ${key} phai chua data-zone="${zoneId}"`,
        );
      }
    }
  });

  test("fitMapRect giu ti le SVG va can giua map doc/ngang", () => {
    assert.deepEqual(fitMapRect(120, 90, "0 0 2 4"), {
      x: 37.5,
      y: 0,
      width: 45,
      height: 90,
    });
    assert.deepEqual(fitMapRect(120, 90, "0 0 4 2"), {
      x: 0,
      y: 15,
      width: 120,
      height: 60,
    });
  });

  test("clampPanToMap khong de lo khoang trong va khong pan khi xem toan canh", () => {
    assert.deepEqual(
      clampPanToMap({
        pan: { x: 99999, y: -99999 },
        zoom: 2,
        containerWidth: 400,
        containerHeight: 300,
        svgWidth: 800,
        svgHeight: 600,
        viewBox: "0 0 4 3",
      }),
      { x: 600, y: -450 },
    );
    assert.deepEqual(
      clampPanToMap({
        pan: { x: 500, y: -500 },
        zoom: 1,
        containerWidth: 800,
        containerHeight: 600,
        svgWidth: 800,
        svgHeight: 600,
        viewBox: "0 0 4 3",
      }),
      { x: 0, y: 0 },
    );
  });

  test("parseViewBox xu ly viewBox hop le va chuoi rong an toan", () => {
    const parsed = parseViewBox("0 0 4000 3000");
    assert.deepEqual(parsed, { minX: 0, minY: 0, width: 4000, height: 3000 });

    const fallback = parseViewBox("");
    assert.equal(fallback.minX, 0);
    assert.equal(fallback.width, 0);

    assert.deepEqual(parseViewBox("0 0 invalid 300"), {
      minX: 0,
      minY: 0,
      width: 0,
      height: 0,
    });
  });

  test("isValidTicketQuantity kiem tra dung khoang 1 den 6 ve theo tieu chuan UC04", () => {
    for (let qty = 1; qty <= 6; qty++) {
      assert.ok(isValidTicketQuantity(qty), `So luong ${qty} ve phai hop le`);
    }
    assert.equal(isValidTicketQuantity(0), false, "0 ve khong hop le");
    assert.equal(
      isValidTicketQuantity(7),
      false,
      "7 ve vuot qua gioi han 6 ve/don",
    );
    assert.equal(isValidTicketQuantity(-1), false, "So am khong hop le");
    assert.equal(
      isValidTicketQuantity(2.5),
      false,
      "So thap phan khong hop le",
    );
  });

  test("isZoneAvailable danh gia chinh xac trang thai con ve cua Zone", () => {
    assert.equal(isZoneAvailable(null, 2), false, "Zone null khong kha dung");
    assert.equal(
      isZoneAvailable({ count: 0 }, 1),
      false,
      "Zone 0 ve la het ve",
    );
    assert.equal(
      isZoneAvailable({ count: 3 }, 4),
      false,
      "Zone chi con 3 ve khong du cho yeu cau 4 ve",
    );
    assert.equal(
      isZoneAvailable({ count: 4 }, 4),
      true,
      "Zone du 4 ve cho yeu cau 4 ve",
    );
    assert.equal(
      isZoneAvailable({ count: 10 }, 6),
      true,
      "Zone du 10 ve cho yeu cau 6 ve",
    );
  });

  test("calculateOrderSubtotal tinh chinh xac tong tien tam tinh don hang", () => {
    assert.equal(calculateOrderSubtotal(450000, 2), 900000);
    assert.equal(calculateOrderSubtotal(1200000, 4), 4800000);
    assert.equal(calculateOrderSubtotal(0, 2), 0);
    assert.equal(calculateOrderSubtotal(500000, 0), 0);
    assert.equal(calculateOrderSubtotal(-100, 2), 0);
  });

  test("computeRemainingSeconds bam holdExpiresAt cua server, lam tron len, khong am", () => {
    assert.equal(computeRemainingSeconds(300_000, 0), 300);
    assert.equal(computeRemainingSeconds(300_000, 299_001), 1);
    assert.equal(computeRemainingSeconds(300_000, 300_000), 0);
    assert.equal(computeRemainingSeconds(300_000, 999_999), 0);
    assert.equal(computeRemainingSeconds(Number.NaN, 0), 0);
  });

  test("getHoldErrorInfo anh xa dung ma loi UC04 (E1, E5, E6, E7)", () => {
    assert.equal(getHoldErrorInfo(401).action, "LOGIN");
    assert.equal(getHoldErrorInfo(403, "FORBIDDEN").action, "NONE");
    assert.equal(getHoldErrorInfo(409).action, "REFRESH");
    assert.equal(
      getHoldErrorInfo(422, undefined, "Qua 6 ve").message,
      "Qua 6 ve",
    );
    assert.equal(getHoldErrorInfo(429).action, "RETRY");
    assert.equal(getHoldErrorInfo(503).action, "RETRY");
    assert.ok(getHoldErrorInfo(500).message.length > 0);
  });
});
