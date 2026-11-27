import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCountdown,
  insufficientTicketsMessage,
  parseHoldSession,
  listingBlockReason,
} from "../src/features/booking/domain/booking-rules.ts";
import {
  buildZoneInfoMap,
  filterListingsByZone,
} from "../src/features/event/domain/zone-info.ts";
import type { TicketListing } from "../src/features/event/domain/event.types.ts";
import {
  eventMapKey,
  toTicketListings,
} from "../src/features/event/domain/ticket-listings.ts";
import type { PublicEvent, PublicTicketType } from "@tickethub/shared";

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
  overrides: Partial<TicketListing> = {},
): TicketListing {
  return {
    id: `${zoneId}-${price}`,
    eventId: "e1",
    zoneId,
    zoneName: `Khu ${zoneId}`,
    price,
    availableTickets: available,
    maxPerOrder: 6,
    onSale: true,
    isStanding: false,
    ...overrides,
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

describe("Event domain: zone info from live listings", () => {
  test("skips unmapped ticket types and counts nothing outside the sale window", () => {
    const map = buildZoneInfoMap([
      listing("", 100, 5),
      listing("A", 300, 5, { onSale: false }),
    ]);
    assert.deepEqual(Object.keys(map), ["A"]);
    assert.equal(map.A?.count, 0);
  });
});

const ticketType = (
  overrides: Partial<PublicTicketType> = {},
): PublicTicketType => ({
  id: "t1",
  name: "VIP",
  description: null,
  price: 500000,
  capacity: 10,
  heldCount: 2,
  soldCount: 3,
  isSeated: true,
  saleStartTime: "2026-11-01T00:00:00.000Z",
  saleEndTime: "2026-11-30T00:00:00.000Z",
  maxPerOrder: 6,
  mapZone: "5715",
  ...overrides,
});
const publicEvent = (overrides: Partial<PublicEvent>) =>
  ({ id: "e1", mapKey: null, ticketTypes: [], ...overrides }) as PublicEvent;

describe("Event domain: ticket listings", () => {
  const at = (iso: string, type = ticketType()) =>
    toTicketListings(publicEvent({ ticketTypes: [type] }), Date.parse(iso))[0]!;

  test("maps remaining tickets, zone and standing flag", () => {
    assert.deepEqual(at("2026-11-10T00:00:00.000Z"), {
      id: "t1",
      eventId: "e1",
      zoneId: "5715",
      zoneName: "VIP",
      price: 500000,
      availableTickets: 5,
      maxPerOrder: 6,
      onSale: true,
      isStanding: false,
    });
  });

  test("is on sale from the opening instant until just before closing", () => {
    assert.equal(at("2026-10-31T23:59:59.000Z").onSale, false);
    assert.equal(at("2026-11-01T00:00:00.000Z").onSale, true);
    assert.equal(at("2026-11-30T00:00:00.000Z").onSale, false);
  });

  test("keeps an unmapped ticket type in the list with an empty zone", () => {
    const result = at(
      "2026-11-10T00:00:00.000Z",
      ticketType({ mapZone: null, isSeated: false }),
    );
    assert.equal(result.zoneId, "");
    assert.equal(result.isStanding, true);
  });

  test("shows a map only for a known map key", () => {
    assert.equal(eventMapKey(publicEvent({ mapKey: "theater" })), "theater");
    assert.equal(eventMapKey(publicEvent({ mapKey: "khong-co" })), null);
    assert.equal(eventMapKey(publicEvent({ mapKey: "toString" })), null);
    assert.equal(eventMapKey(publicEvent({ mapKey: null })), null);
  });
});

describe("Booking domain: blocked listings", () => {
  test("blocks closed sales, sold out and over-limit quantities", () => {
    assert.match(
      listingBlockReason(listing("A", 1, 5, { onSale: false }), 1)!,
      /thời gian mở bán/,
    );
    assert.match(listingBlockReason(listing("A", 1, 0), 1)!, /Hết vé/);
    assert.match(listingBlockReason(listing("A", 1, 2), 3)!, /chỉ còn 2 vé/);
    assert.match(
      listingBlockReason(listing("A", 1, 50, { maxPerOrder: 2 }), 3)!,
      /tối đa 2 vé/,
    );
    assert.match(
      listingBlockReason(listing("A", 1, 50, { maxPerOrder: 10 }), 7)!,
      /tối đa 6 vé/,
    );
  });

  test("allows a quantity within every limit", () => {
    assert.equal(listingBlockReason(listing("A", 1, 2), 2), null);
  });
});
