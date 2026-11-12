import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertEditable,
  assertVerifiedOrganizer,
  assertVersionMatches,
  assertZonesMatchTicketTypes,
  buildInventoryItems,
  buildUpdatePatch,
  formatSeatNumber,
  groupSeatMap,
  planSeats,
} from "../src/contexts/event/domain/event-rules";
import { EventDomainError } from "../src/contexts/event/domain/event.errors";
import { EventReadModel } from "../src/contexts/event/application/event-read-model";
import type {
  EventReadRepository,
  ReadCache,
} from "../src/contexts/event/domain/event.ports";

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof EventDomainError);
    return err.code;
  }
  return "NONE";
}

describe("Event domain rules", () => {
  it("requires an existing, verified organizer profile", () => {
    assert.equal(
      codeOf(() => assertVerifiedOrganizer(null)),
      "ORGANIZER_PROFILE_REQUIRED",
    );
    assert.equal(
      codeOf(() => assertVerifiedOrganizer({ id: "p", status: "PENDING" })),
      "ORGANIZER_NOT_VERIFIED",
    );
    assert.equal(
      codeOf(() => assertVerifiedOrganizer({ id: "p", status: "VERIFIED" })),
      "NONE",
    );
  });

  it("only DRAFT events are editable and versions must match", () => {
    assert.equal(
      codeOf(() => assertEditable({ status: "DRAFT" })),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertEditable({ status: "PUBLISHED" })),
      "EVENT_CANNOT_BE_EDITED",
    );
    assert.equal(
      codeOf(() => assertVersionMatches({ version: 3 }, 2)),
      "CONCURRENT_MODIFICATION",
    );
    assert.equal(
      codeOf(() => assertVersionMatches({ version: 3 }, 3)),
      "NONE",
    );
  });

  it("builds a patch with a bumped version and only provided fields", () => {
    const now = new Date("2026-11-11T00:00:00Z");
    const patch = buildUpdatePatch(
      { version: 4 },
      { title: "Moi", startTime: "2026-12-01T10:00:00Z", version: 4 },
      now,
    );
    assert.equal(patch.version, 5);
    assert.equal(patch.title, "Moi");
    assert.equal(patch.startTime?.toISOString(), "2026-12-01T10:00:00.000Z");
    assert.equal("city" in patch, false);
  });

  it("pads seat numbers and plans seats per zone with capacity totals", () => {
    assert.equal(formatSeatNumber(9), "09");
    assert.equal(formatSeatNumber(10), "10");

    const plan = planSeats([
      { zoneName: "A", ticketTypeId: "t1", rows: ["A", "B"], seatsPerRow: 3 },
      { zoneName: "B", ticketTypeId: "t1", rows: ["C"], seatsPerRow: 2 },
      { zoneName: "C", ticketTypeId: "t2", rows: ["D"], seatsPerRow: 1 },
    ]);
    assert.equal(plan.seats.length, 9);
    assert.equal(plan.capacityByTicketType.get("t1"), 8);
    assert.equal(plan.capacityByTicketType.get("t2"), 1);
    assert.deepEqual(
      plan.seats.slice(0, 3).map((s) => `${s.rowLabel}${s.seatNumber}`),
      ["A01", "A02", "A03"],
    );
  });

  it("rejects zones pointing at unknown or standing ticket types", () => {
    const types = [
      { id: "seated", name: "VIP", isSeated: true },
      { id: "ga", name: "GA", isSeated: false },
    ];
    const zone = (ticketTypeId: string) => [
      { zoneName: "Z", ticketTypeId, rows: ["A"], seatsPerRow: 1 },
    ];
    assert.equal(
      codeOf(() => assertZonesMatchTicketTypes(types, zone("seated"))),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertZonesMatchTicketTypes(types, zone("x"))),
      "INVALID_TICKET_TYPE",
    );
    assert.equal(
      codeOf(() => assertZonesMatchTicketTypes(types, zone("ga"))),
      "TICKET_TYPE_NOT_SEATED",
    );
  });

  it("groups seats into zones and rows preserving order", () => {
    const map = groupSeatMap("e1", [
      {
        id: "1",
        zoneName: "A",
        ticketTypeId: "t",
        rowLabel: "A",
        seatNumber: "01",
        status: "AVAILABLE",
      },
      {
        id: "2",
        zoneName: "A",
        ticketTypeId: "t",
        rowLabel: "A",
        seatNumber: "02",
        status: "SOLD",
      },
      {
        id: "3",
        zoneName: "A",
        ticketTypeId: "t",
        rowLabel: "B",
        seatNumber: "01",
        status: "HELD",
      },
    ]);
    assert.equal(map.zones.length, 1);
    assert.equal(map.zones[0]?.rows.length, 2);
    assert.equal(map.zones[0]?.rows[0]?.seats.length, 2);
  });

  it("computes standing inventory from counters and seated from seat counts", () => {
    const items = buildInventoryItems(
      [
        {
          id: "ga",
          name: "GA",
          price: "100",
          capacity: 10,
          heldCount: 3,
          soldCount: 9,
          isSeated: false,
        },
        {
          id: "vip",
          name: "VIP",
          price: "500",
          capacity: 4,
          heldCount: 0,
          soldCount: 0,
          isSeated: true,
        },
      ],
      [{ ticketTypeId: "vip", available: 2, held: 1, sold: 1, blocked: 0 }],
    );
    assert.equal(items[0]?.available, 0); // khong am
    assert.equal(items[0]?.sold, 9);
    assert.equal(items[1]?.available, 2);
    assert.equal(items[1]?.held, 1);
  });
});

describe("EventReadModel cache-aside", () => {
  it("serves the second call from cache and refreshes after invalidate", async () => {
    const store = new Map<string, unknown>();
    const cache: ReadCache = {
      get: async <T>(k: string) => (store.get(k) as T | undefined) ?? null,
      set: async (k, v) => void store.set(k, v),
      del: async (...ks) => void ks.forEach((k) => store.delete(k)),
    };
    let loads = 0;
    const reader = {
      findWithTicketTypes: async () => {
        loads++;
        return { id: "e1" } as never;
      },
      listSeatsOrdered: async () => [],
    } as unknown as EventReadRepository;

    const model = new EventReadModel(cache, reader);
    await model.getSeatMap("e1");
    await model.getSeatMap("e1");
    assert.equal(loads, 1);

    await model.invalidate("e1");
    await model.getSeatMap("e1");
    assert.equal(loads, 2);
  });

  it("maps a missing event to EVENT_NOT_FOUND and unpublished inventory to a plain error", async () => {
    const cache: ReadCache = {
      get: async () => null,
      set: async () => undefined,
      del: async () => undefined,
    };
    const reader = {
      findWithTicketTypes: async () => null,
      publishedEventExists: async () => false,
    } as unknown as EventReadRepository;
    const model = new EventReadModel(cache, reader);

    await assert.rejects(
      () => model.getSeatMap("x"),
      (e: unknown) =>
        e instanceof EventDomainError && e.code === "EVENT_NOT_FOUND",
    );
    await assert.rejects(
      () => model.getInventory("x"),
      (e: unknown) => e instanceof EventDomainError && e.plainMessage === true,
    );
  });
});
