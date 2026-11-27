import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  groupOrderItems,
  listedTickets,
  seatDetail,
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
    assert.match(noQrReason(order("CANCELLED", []))!, /đã hủy/);
    assert.match(
      noQrReason(order("PAYMENT_EXPIRED_REFUND_PENDING", []))!,
      /hoàn lại/,
    );
    assert.match(noQrReason(order("EXPIRED", []))!, /hết hạn giữ chỗ/);
    assert.match(noQrReason(order("FAILED", []))!, /không thành công/);
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

describe("Order page labels", () => {
  const seat = (row: string, num: string) => ({
    status: "SOLD",
    isSeated: true,
    seatInfo: {
      rowLabel: row,
      seatNumber: num,
      formattedLabel: `Khu VIP A - Hàng ${row} - Ghế ${num}`,
    },
  });

  test("ghe chi ghi hang va so, khong lap ten khu", () => {
    assert.equal(seatDetail(seat("A", "09")), "Hàng A, ghế 09");
  });

  test("ve dung giu nhan cua backend", () => {
    const standing = {
      status: "SOLD",
      isSeated: false,
      seatInfo: {
        rowLabel: null,
        seatNumber: null,
        formattedLabel: "Khu vực: GA (Vé đứng)",
      },
    };
    assert.equal(seatDetail(standing), "Khu vực: GA (Vé đứng)");
  });

  test("ve sap theo hang roi so ghe", () => {
    const result = listedTickets({
      status: "PAID",
      event: { status: "PUBLISHED" },
      tickets: [seat("B", "01"), seat("A", "10"), seat("A", "09")],
    });
    assert.deepEqual(result.map(seatDetail), [
      "Hàng A, ghế 09",
      "Hàng A, ghế 10",
      "Hàng B, ghế 01",
    ]);
  });

  test("gop cac dong cung hang ve va cung don gia", () => {
    const line = (name: string, unitPrice: number, quantity: number) => ({
      ticketTypeId: name,
      ticketTypeName: name,
      unitPrice,
      quantity,
      subtotal: unitPrice * quantity,
    });
    assert.deepEqual(
      groupOrderItems([
        line("VIP", 100, 1),
        line("GA", 50, 2),
        line("VIP", 100, 1),
      ]),
      [
        { key: "VIP:100", name: "VIP", quantity: 2, subtotal: 200 },
        { key: "GA:50", name: "GA", quantity: 2, subtotal: 100 },
      ],
    );
  });
});
