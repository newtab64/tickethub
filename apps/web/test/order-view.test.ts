import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  listedTickets,
  noQrReason,
  primaryAction,
} from "../src/features/booking/domain/ticket-qr.ts";

const order = (
  status: string,
  tickets: string[],
  eventStatus = "PUBLISHED",
) => ({
  status,
  event: { status: eventStatus },
  tickets: tickets.map((s) => ({ status: s })),
});

describe("Order page rules", () => {
  test("don cho thanh toan thi viec chinh la tra tien", () => {
    assert.equal(primaryAction(order("PENDING", [])), "pay");
    assert.equal(noQrReason(order("PENDING", [])), null);
  });

  test("co ve con hieu luc thi viec chinh la vao cong", () => {
    const paid = order("PAID", ["SOLD", "CANCELLED"]);
    assert.equal(primaryAction(paid), "qr");
    assert.equal(noQrReason(paid), null);
  });

  test("giai thich vi sao khong co ma", () => {
    const suspended = order("PAID", ["SOLD"], "SUSPENDED");
    assert.equal(primaryAction(suspended), "none");
    assert.match(noQrReason(suspended)!, /Sự kiện hiện không mở/);
    const used = order("PAID", ["CHECKED_IN", "CANCELLED"]);
    assert.equal(primaryAction(used), "none");
    assert.match(noQrReason(used)!, /không còn vé/);
    assert.match(noQrReason(order("PAID", []))!, /sẽ xuất hiện/);
    assert.match(noQrReason(order("CANCELLED", []))!, /không có vé/);
  });

  test("ve da huy khong nam trong danh sach", () => {
    const result = listedTickets(
      order("PAID", ["SOLD", "CANCELLED", "CHECKED_IN"]),
    );
    assert.deepEqual(
      result.map((t) => t.status),
      ["SOLD", "CHECKED_IN"],
    );
  });
});
