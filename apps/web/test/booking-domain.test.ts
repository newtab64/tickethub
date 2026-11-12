import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCountdown,
  insufficientTicketsMessage,
  parseHoldSession,
} from "../src/features/booking/domain/booking-rules.ts";
import {
  buildZoneInfoMap,
  filterListingsByZone,
} from "../src/features/event/domain/zone-info.ts";
import type { TicketListing } from "../src/features/event/domain/event.types.ts";

const NOW = Date.parse("2026-11-11T10:00:00.000Z");

describe("Booking domain: hold session", () => {
  test("uses the server holdExpiresAt as the source of truth", () => {
    const session = parseHoldSession(
      {
        orderId: "o1",
        orderCode: "ORD-1",
        holdExpiresAt: new Date(NOW + 300_000).toISOString(),
        totalAmount: 5_000_000,
        allocatedSeats: [
          { id: "s1", zoneName: "VIP", rowLabel: "A", seatNumber: "01" },
        ],
      },
      NOW,
    );
    assert.equal(session.secondsLeft, 300);
    assert.equal(session.expiresAtMs, NOW + 300_000);
    assert.equal(session.totalAmount, 5_000_000);
    assert.equal(session.allocatedSeats.length, 1);
  });

  test("falls back to remainingSeconds when holdExpiresAt is missing", () => {
    const session = parseHoldSession(
      { orderId: "o1", orderCode: "C", remainingSeconds: "120" },
      NOW,
    );
    assert.equal(session.secondsLeft, 120);
    assert.equal(session.expiresAtMs, NOW + 120_000);
    assert.equal(session.totalAmount, null);
    assert.deepEqual(session.allocatedSeats, []);
  });

  test("rejects a session that is already expired", () => {
    assert.throws(
      () =>
        parseHoldSession(
          {
            orderId: "o1",
            orderCode: "C",
            holdExpiresAt: new Date(NOW - 1000).toISOString(),
          },
          NOW,
        ),
      /hết hạn ngay/,
    );
    assert.throws(() =>
      parseHoldSession({ orderId: "o", orderCode: "C" }, NOW),
    );
  });

  test("formats the countdown as MM:SS", () => {
    assert.equal(formatCountdown(300), "05:00");
    assert.equal(formatCountdown(61), "01:01");
    assert.equal(formatCountdown(0), "00:00");
  });

  test("explains when a ticket class cannot satisfy the requested quantity", () => {
    const msg = insufficientTicketsMessage("Khu VIP A", 2, 4);
    assert.match(msg, /Khu VIP A chỉ còn 2 vé/);
    assert.match(msg, /yêu cầu 4 vé/);
  });
});

function listing(
  zoneId: string,
  price: number,
  available: number,
): TicketListing {
  return {
    id: `${zoneId}-${price}`,
    eventId: "e",
    zoneId,
    zoneName: `Khu ${zoneId}`,
    section: `Khu ${zoneId}`,
    seatInfo: "",
    price,
    availableTickets: available,
    dealScore: 1,
    dealLabel: "Tốt",
    features: [],
    viewFromSeatUrl: "",
  };
}

describe("Event domain: zone info", () => {
  const listings = [
    listing("A", 500, 10),
    listing("A", 300, 5),
    listing("B", 900, 0),
  ];

  test("accumulates the lowest price and total tickets per zone", () => {
    const map = buildZoneInfoMap(listings);
    assert.deepEqual(map.A, { name: "Khu A", minPrice: 300, count: 15 });
    assert.deepEqual(map.B, { name: "Khu B", minPrice: 900, count: 0 });
  });

  test("filters by the active zone, or keeps everything when none is active", () => {
    assert.equal(filterListingsByZone(listings, "A").length, 2);
    assert.equal(filterListingsByZone(listings, "B").length, 1);
    assert.equal(filterListingsByZone(listings, null).length, 3);
  });
});
