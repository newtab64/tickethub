import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventStatus, TicketStatus, UserRole } from "@tickethub/shared";
import {
  assertEventActive,
  assertLookupEligible,
  assertQrIssuable,
  explainFailedCheckIn,
  matchesBuyerLast4,
  requiresStaffAssignment,
  seatLabelFor,
} from "../src/contexts/ticketing/domain/checkin-rules";
import { TicketingDomainError } from "../src/contexts/ticketing/domain/ticketing.errors";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof TicketingDomainError);
    return err.code;
  }
  return "NONE";
}

const ticket = (overrides = {}) => ({
  id: "t1",
  userId: "u1",
  orderId: "o1",
  eventId: "e1",
  status: TicketStatus.SOLD,
  eventStatus: EventStatus.PUBLISHED,
  ...overrides,
});

describe("QR issuance rules", () => {
  it("allows the owner (or an admin) of an active ticket", () => {
    assert.equal(
      codeOf(() => assertQrIssuable(ticket(), "u1", UserRole.BUYER)),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertQrIssuable(ticket(), "x", UserRole.ADMIN)),
      "NONE",
    );
  });

  it("rejects missing, foreign, used, inactive tickets and suspended events", () => {
    assert.equal(
      codeOf(() => assertQrIssuable(null, "u1", UserRole.BUYER)),
      "TICKET_NOT_FOUND",
    );
    assert.equal(
      codeOf(() => assertQrIssuable(ticket(), "other", UserRole.BUYER)),
      "ACCESS_DENIED",
    );
    assert.equal(
      codeOf(() =>
        assertQrIssuable(
          ticket({ status: TicketStatus.CHECKED_IN }),
          "u1",
          UserRole.BUYER,
        ),
      ),
      "TICKET_ALREADY_USED",
    );
    assert.equal(
      codeOf(() =>
        assertQrIssuable(
          ticket({ status: TicketStatus.CANCELLED }),
          "u1",
          UserRole.BUYER,
        ),
      ),
      "TICKET_NOT_ACTIVE",
    );
    assert.equal(
      codeOf(() =>
        assertQrIssuable(
          ticket({ eventStatus: EventStatus.SUSPENDED }),
          "u1",
          UserRole.BUYER,
        ),
      ),
      "EVENT_NOT_ACTIVE",
    );
  });
});

describe("gate rules", () => {
  it("requires assignment for everyone except admins", () => {
    assert.equal(requiresStaffAssignment(UserRole.GATE_STAFF), true);
    assert.equal(requiresStaffAssignment(UserRole.ADMIN), false);
  });

  it("blocks scanning when the event is missing or not PUBLISHED (kill switch)", () => {
    assert.equal(
      codeOf(() => assertEventActive(null)),
      "EVENT_NOT_ACTIVE",
    );
    assert.equal(
      codeOf(() =>
        assertEventActive({
          id: "e",
          title: "E",
          status: EventStatus.SUSPENDED,
        }),
      ),
      "EVENT_NOT_ACTIVE",
    );
    assert.equal(
      codeOf(() =>
        assertEventActive({
          id: "e",
          title: "E",
          status: EventStatus.PUBLISHED,
        }),
      ),
      "NONE",
    );
  });

  it("explains a failed atomic check-in", () => {
    assert.equal(
      codeOf(() => explainFailedCheckIn(null)),
      "TICKET_NOT_FOUND",
    );
    assert.equal(
      codeOf(() =>
        explainFailedCheckIn({
          id: "t",
          status: TicketStatus.CHECKED_IN,
          checkedInAt: new Date("2026-11-11T10:00:00Z"),
          checkedInBy: "staff-1",
        }),
      ),
      "TICKET_ALREADY_USED",
    );
    assert.equal(
      codeOf(() =>
        explainFailedCheckIn({
          id: "t",
          status: TicketStatus.CANCELLED,
          checkedInAt: null,
          checkedInBy: null,
        }),
      ),
      "TICKET_NOT_ELIGIBLE",
    );
  });

  it("includes who and when in the already-used message", () => {
    try {
      explainFailedCheckIn({
        id: "t",
        status: TicketStatus.CHECKED_IN,
        checkedInAt: new Date("2026-11-11T10:00:00Z"),
        checkedInBy: "staff-1",
      });
    } catch (err) {
      assert.match(
        (err as Error).message,
        /2026-11-11T10:00:00.000Z by staff staff-1/,
      );
    }
  });

  it("only SOLD tickets are eligible for manual lookup", () => {
    assert.equal(
      codeOf(() => assertLookupEligible({ status: TicketStatus.SOLD })),
      "NONE",
    );
    assert.equal(
      codeOf(() => assertLookupEligible({ status: TicketStatus.CHECKED_IN })),
      "TICKET_ALREADY_USED",
    );
    assert.equal(
      codeOf(() => assertLookupEligible({ status: TicketStatus.CANCELLED })),
      "TICKET_NOT_ELIGIBLE",
    );
  });
});

describe("manual lookup verification", () => {
  it("matches the last 4 digits of the phone, ignoring formatting", () => {
    const buyer = { phone: "+84 90-123-4567", email: null };
    assert.equal(matchesBuyerLast4(buyer, "4567"), true);
    assert.equal(matchesBuyerLast4(buyer, "0000"), false);
  });

  it("matches the last 4 characters of the email local part or the whole email", () => {
    const buyer = { phone: null, email: "Nguyen.Van@Example.com" };
    assert.equal(matchesBuyerLast4(buyer, "  .Van "), true);
    assert.equal(matchesBuyerLast4(buyer, ".com"), true);
    assert.equal(matchesBuyerLast4(buyer, "zzzz"), false);
  });

  it("never matches when the buyer has no contact data", () => {
    assert.equal(
      matchesBuyerLast4({ phone: null, email: null }, "1234"),
      false,
    );
  });
});

describe("seat label", () => {
  it("shows row and seat for seated tickets and a standing label otherwise", () => {
    assert.equal(
      seatLabelFor({
        isSeated: true,
        zoneName: "A",
        rowLabel: "B",
        seatNumber: "07",
      }),
      "Hàng B - Ghế 07",
    );
    assert.equal(
      seatLabelFor({
        isSeated: false,
        zoneName: null,
        rowLabel: null,
        seatNumber: null,
      }),
      "GA - Fanzone (Vé đứng)",
    );
    assert.equal(seatLabelFor(null), "GA - Fanzone (Vé đứng)");
  });
});
