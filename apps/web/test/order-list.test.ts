import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { orderTone } from "../src/features/booking/domain/order-list.ts";

describe("Nhãn trạng thái ở Vé của tôi", () => {
  test("mỗi trạng thái đúng màu theo thiết kế", () => {
    assert.deepEqual(
      Object.fromEntries(
        [
          "PENDING",
          "PAID",
          "PAYMENT_EXPIRED_REFUND_PENDING",
          "FAILED",
          "CANCELLED",
          "EXPIRED",
          "REFUNDED",
        ].map((status) => [status, orderTone(status)]),
      ),
      {
        PENDING: "warning",
        PAID: "success",
        PAYMENT_EXPIRED_REFUND_PENDING: "warning",
        FAILED: "destructive",
        CANCELLED: "neutral",
        EXPIRED: "neutral",
        REFUNDED: "neutral",
      },
    );
  });
});
