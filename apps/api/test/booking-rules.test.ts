import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findContiguousSeats,
  parseSeatNumber,
  sortAllocatedSeats,
} from "../src/contexts/booking/domain/seat-allocation";
import {
  assertEventOnSale,
  assertExplicitSeatsMatch,
  assertNoDuplicateSeats,
  assertReleasable,
  assertStandingAvailable,
  assertWithinTicketLimit,
  classifyItems,
  generateOrderCode,
  standingLine,
} from "../src/contexts/booking/domain/booking-rules";
import { BookingDomainError } from "../src/contexts/booking/domain/booking.errors";
import type { CandidateSeat } from "../src/contexts/booking/domain/booking.models";

const seat = (row: string, num: number): CandidateSeat => ({
  id: `${row}${num}`,
  zoneName: "Z",
  rowLabel: row,
  seatNumber: String(num).padStart(2, "0"),
  ticketTypeId: "t",
});

const ids = (seats: CandidateSeat[]) => seats.map((s) => s.id);

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof BookingDomainError);
    return err.code;
  }
  return "NONE";
}

describe("findContiguousSeats", () => {
  it("parses the numeric part of a seat number", () => {
    assert.equal(parseSeatNumber("A07"), 7);
    assert.equal(parseSeatNumber("xx"), 0);
  });

  it("prefers a consecutive run within one row", () => {
    const picked = findContiguousSeats(
      [seat("A", 1), seat("A", 3), seat("A", 4), seat("A", 5), seat("B", 1)],
      3,
    );
    assert.deepEqual(ids(picked), ["A3", "A4", "A5"]);
  });

  it("skips a row that has no consecutive run of the needed size", () => {
    const picked = findContiguousSeats(
      [seat("A", 1), seat("A", 3), seat("B", 5), seat("B", 6)],
      2,
    );
    assert.deepEqual(ids(picked), ["B5", "B6"]);
  });

  it("falls back to the same row when seats are not adjacent", () => {
    const picked = findContiguousSeats(
      [seat("A", 1), seat("A", 3), seat("A", 5), seat("B", 2)],
      3,
    );
    assert.deepEqual(ids(picked), ["A1", "A3", "A5"]);
  });

  it("falls back to different rows, and returns nothing when short", () => {
    const picked = findContiguousSeats(
      [seat("A", 1), seat("B", 1), seat("C", 1)],
      3,
    );
    assert.equal(picked.length, 3);
    assert.deepEqual(findContiguousSeats([seat("A", 1)], 2), []);
  });

  it("orders allocated seats by row then seat number for display", () => {
    const sorted = sortAllocatedSeats([
      seat("B", 2),
      seat("A", 10),
      seat("A", 2),
    ]);
    assert.deepEqual(ids(sorted as CandidateSeat[]), ["A2", "A10", "B2"]);
  });
});

describe("booking rules", () => {
  it("only lets PUBLISHED events be booked", () => {
    assert.equal(
      codeOf(() => assertEventOnSale(null)),
      "EVENT_NOT_FOUND",
    );
    assert.equal(
      codeOf(() => assertEventOnSale({ status: "DRAFT" })),
      "EVENT_NOT_PUBLISHED",
    );
    assert.equal(
      codeOf(() => assertEventOnSale({ status: "PUBLISHED" })),
      "NONE",
    );
  });

  it("caps an order at 6 tickets, counting a missing quantity as 1", () => {
    const item = (q?: number) =>
      ({
        ticketTypeId: "t",
        ...(q === undefined ? {} : { quantity: q }),
      }) as never;
    assert.equal(
      codeOf(() => assertWithinTicketLimit([item(3), item(3)])),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertWithinTicketLimit([item(3), item(3), item()])),
      "MAX_TICKETS_EXCEEDED",
    );
  });

  it("classifies items into explicit, auto-seated and standing", () => {
    const types = new Map([
      ["seated", { id: "seated", price: "1", isSeated: true }],
      ["ga", { id: "ga", price: "1", isSeated: false }],
    ]);
    const out = classifyItems(
      [
        { ticketTypeId: "seated", seatId: "s1" },
        { ticketTypeId: "seated", quantity: 2 },
        { ticketTypeId: "ga", quantity: 3 },
      ] as never,
      types,
    );
    assert.equal(out.explicitSeated.length, 1);
    assert.equal(out.autoSeated.length, 1);
    assert.equal(out.standing.length, 1);
  });

  it("rejects duplicate seats and seat/ticket type mismatches", () => {
    assert.equal(
      codeOf(() => assertNoDuplicateSeats(["a", "a"])),
      "DUPLICATE_SEATS",
    );
    assert.equal(
      codeOf(() => assertNoDuplicateSeats(["a", "b"])),
      "NONE",
    );
    assert.equal(
      codeOf(() =>
        assertExplicitSeatsMatch(
          [{ ticketTypeId: "t1", seatId: "s" }] as never,
          new Map([["s", "t2"]]),
        ),
      ),
      "SEAT_TICKET_TYPE_MISMATCH",
    );
  });

  it("checks standing capacity using held and sold counters", () => {
    const inv = {
      id: "t",
      capacity: 10,
      heldCount: 4,
      soldCount: 4,
      isSeated: false,
    };
    assert.equal(
      codeOf(() => assertStandingAvailable(inv, 2)),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertStandingAvailable(inv, 3)),
      "INSUFFICIENT_TICKET_CAPACITY",
    );
    assert.equal(
      codeOf(() => assertStandingAvailable(null, 1)),
      "INVALID_TICKET_TYPE",
    );
    assert.equal(
      codeOf(() => assertStandingAvailable({ ...inv, isSeated: true }, 1)),
      "INVALID_TICKET_TYPE",
    );
  });

  it("builds standing order lines with a computed subtotal", () => {
    assert.deepEqual(standingLine("t", 3, 150000), {
      ticketTypeId: "t",
      seatId: null,
      quantity: 3,
      unitPrice: "150000.00",
      subtotal: "450000.00",
    });
  });

  it("formats order codes as ORD-YYYYMMDD-SUFFIX", () => {
    assert.equal(
      generateOrderCode(new Date(2026, 10, 5), "ABC123"),
      "ORD-20261105-ABC123",
    );
  });

  it("allows releasing only existing PENDING orders", () => {
    assert.equal(
      codeOf(() => assertReleasable(null)),
      "ORDER_NOT_FOUND",
    );
    assert.equal(
      codeOf(() => assertReleasable({ status: "PAID" })),
      "ORDER_NOT_PENDING",
    );
    assert.equal(
      codeOf(() => assertReleasable({ status: "PENDING" })),
      "NONE",
    );
  });
});
