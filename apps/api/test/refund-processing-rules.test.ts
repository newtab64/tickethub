import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REFUND_ATTEMPTS,
  orderBecomesRefunded,
  parseRefundRequestedPayload,
  refundOrderInfo,
  refundRetryDelayMs,
  refundTransactionType,
  resolveOriginalTransactionDate,
  shouldRetryRefund,
  sumRefundVnd,
} from "../src/contexts/payment/domain/refund-processing";
import { formatVnpayDate } from "../src/contexts/payment/domain/vnpay-date";
import { assertRefundProcessingAllowed } from "../src/contexts/payment/domain/refund-processor-guard";

describe("refund processing rules", () => {
  it("uses type 02 for a full refund and 03 for a partial refund", () => {
    assert.equal(refundTransactionType(false), "02");
    assert.equal(refundTransactionType(true), "03");
  });

  it("sums refund amounts in whole VND", () => {
    assert.equal(sumRefundVnd(["100000.00", "250000.00", 50000]), 400000);
    assert.equal(sumRefundVnd([]), 0);
  });

  it("backs off exponentially and stops after the maximum attempts", () => {
    assert.equal(refundRetryDelayMs(1), 60_000);
    assert.equal(refundRetryDelayMs(2), 120_000);
    assert.equal(shouldRetryRefund(MAX_REFUND_ATTEMPTS - 1), true);
    assert.equal(shouldRetryRefund(MAX_REFUND_ATTEMPTS), false);
  });

  it("formats VNPay dates in GMT+7", () => {
    assert.equal(
      formatVnpayDate(new Date("2026-01-15T03:30:00.000Z")),
      "20260115103000",
    );
  });

  it("prefers the stored create date and falls back to the transaction time", () => {
    const createdAt = new Date("2026-01-15T03:30:00.000Z");
    assert.equal(
      resolveOriginalTransactionDate(
        { vnp_CreateDate: "20260115103005" },
        createdAt,
      ),
      "20260115103005",
    );
    assert.equal(
      resolveOriginalTransactionDate(null, createdAt),
      "20260115103000",
    );
    assert.equal(
      resolveOriginalTransactionDate({ vnp_CreateDate: "bad" }, createdAt),
      "20260115103000",
    );
  });

  it("keeps the order info printable ASCII", () => {
    assert.match(refundOrderInfo("TH123"), /^[\x20-\x7E]+$/);
  });

  it("only moves late-payment orders to REFUNDED when the refund completes", () => {
    assert.equal(orderBecomesRefunded("PAYMENT_EXPIRED_REFUND_PENDING"), true);
    assert.equal(orderBecomesRefunded("PAID"), false);
  });

  it("parses a valid payload and rejects malformed ones", () => {
    assert.deepEqual(
      parseRefundRequestedPayload({
        orderId: "o",
        refundIds: ["r"],
        isPartial: true,
      }),
      { orderId: "o", refundIds: ["r"], isPartial: true },
    );
    assert.equal(parseRefundRequestedPayload(null), null);
    assert.equal(
      parseRefundRequestedPayload({
        orderId: "o",
        refundIds: [],
        isPartial: false,
      }),
      null,
    );
    assert.equal(
      parseRefundRequestedPayload({ orderId: "o", refundIds: ["r"] }),
      null,
    );
  });
});

describe("refund processor guard", () => {
  const ok = {
    ENABLE_VNPAY_REFUND_PROCESSING: "true",
    VNPAY_TMN_CODE: "REALCODE",
    VNPAY_HASH_SECRET: "real-secret",
  };

  it("requires explicit enablement", () => {
    assert.throws(() =>
      assertRefundProcessingAllowed({
        ...ok,
        ENABLE_VNPAY_REFUND_PROCESSING: undefined,
      }),
    );
    assert.doesNotThrow(() => assertRefundProcessingAllowed(ok));
  });

  it("refuses placeholder credentials", () => {
    assert.throws(() =>
      assertRefundProcessingAllowed({ ...ok, VNPAY_TMN_CODE: "TEST_TMN_CODE" }),
    );
    assert.throws(() =>
      assertRefundProcessingAllowed({
        ...ok,
        VNPAY_HASH_SECRET: "TEST_HASH_SECRET",
      }),
    );
  });
});
