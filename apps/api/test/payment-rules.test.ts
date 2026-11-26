import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrderStatus, TransactionStatus } from "@tickethub/shared";
import {
  MIN_REMAINING_HOLD_MS,
  assertExistingTransactionReusable,
  assertOrderPayable,
  generateTransactionRef,
  resolveAmountVnd,
  resolveClientIp,
} from "../src/contexts/payment/domain/payment-rules";
import {
  amountsMatch,
  areSettlementItemsValid,
  buildCallbackEvidence,
  evaluateIpn,
  isFinalCallback,
} from "../src/contexts/payment/domain/ipn-rules";
import { PaymentDomainError } from "../src/contexts/payment/domain/payment.errors";
import type { PaymentOrder } from "../src/contexts/payment/domain/payment.models";

const NOW = new Date("2026-11-11T10:00:00.000Z");

const order = (overrides: Partial<PaymentOrder> = {}): PaymentOrder => ({
  id: "o1",
  orderCode: "ORD-1",
  userId: "u1",
  eventId: "e1",
  status: OrderStatus.PENDING,
  finalAmount: "150000.00",
  expiresAt: new Date(NOW.getTime() + 5 * 60 * 1000),
  ...overrides,
});

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof PaymentDomainError);
    return err.message;
  }
  return "NONE";
}

describe("payment rules", () => {
  it("requires an existing PENDING order with enough hold time left", () => {
    assert.equal(
      messageOf(() => assertOrderPayable(null, NOW)),
      "Order not found",
    );
    assert.equal(
      messageOf(() =>
        assertOrderPayable(order({ status: OrderStatus.PAID }), NOW),
      ),
      "Order is not pending",
    );
    const tooClose = order({
      expiresAt: new Date(NOW.getTime() + MIN_REMAINING_HOLD_MS),
    });
    assert.equal(
      messageOf(() => assertOrderPayable(tooClose, NOW)),
      "Order hold is expired or too close to expiry",
    );
    assert.equal(
      messageOf(() => assertOrderPayable(order(), NOW)),
      "NONE",
    );
  });

  it("reuses a PENDING transaction only when the amount still matches", () => {
    const tx = (status: TransactionStatus, amount = "150000.00") => ({
      id: "t",
      transactionRef: "R",
      status,
      amount,
    });
    assert.equal(
      messageOf(() => assertExistingTransactionReusable(null, order())),
      "NONE",
    );
    assert.equal(
      messageOf(() =>
        assertExistingTransactionReusable(
          tx(TransactionStatus.PENDING),
          order(),
        ),
      ),
      "NONE",
    );
    assert.equal(
      messageOf(() =>
        assertExistingTransactionReusable(
          tx(TransactionStatus.FAILED),
          order(),
        ),
      ),
      "VNPay transaction is no longer pending",
    );
    assert.equal(
      messageOf(() =>
        assertExistingTransactionReusable(
          tx(TransactionStatus.PENDING, "1.00"),
          order(),
        ),
      ),
      "Payment amount mismatch",
    );
  });

  it("derives the VND amount from the stored value and rejects invalid ones", () => {
    assert.equal(resolveAmountVnd(order()), 150000);
    assert.equal(
      messageOf(() => resolveAmountVnd(order({ finalAmount: "10.50" }))),
      "Invalid order amount for VNPay",
    );
  });

  it("generates alphanumeric references and falls back to a safe client IP", () => {
    assert.match(generateTransactionRef(), /^BE2[0-9A-F]{24}$/);
    assert.notEqual(generateTransactionRef(), generateTransactionRef());
    assert.equal(resolveClientIp("203.0.113.9, 10.0.0.1"), "203.0.113.9");
    assert.equal(resolveClientIp("not-an-ip"), "127.0.0.1");
    assert.equal(resolveClientIp(undefined), "127.0.0.1");
  });
});

describe("IPN rules", () => {
  it("accepts only final callbacks", () => {
    const p = (code: string, status: string) => ({
      vnp_ResponseCode: code,
      vnp_TransactionStatus: status,
    });
    assert.equal(isFinalCallback(p("00", "00")), true);
    assert.equal(isFinalCallback(p("24", "02")), true);
    assert.equal(isFinalCallback(p("07", "02")), false);
    assert.equal(isFinalCallback(p("00", "01")), false);
  });

  it("matches the callback amount against both transaction and order", () => {
    assert.equal(amountsMatch("15000000", "150000.00", "150000.00"), true);
    assert.equal(amountsMatch("15000000", "150000.00", "140000.00"), false);
    assert.equal(amountsMatch("1", "150000.00", "150000.00"), false);
    assert.equal(amountsMatch("15000000", "abc", "150000.00"), false);
  });

  it("evaluates success, repeat, expiry and amount mismatch", () => {
    const base = {
      params: { vnp_Amount: "15000000" },
      paymentSuccessful: true,
      transaction: { status: TransactionStatus.PENDING, amount: "150000.00" },
      order: order(),
      now: NOW,
    };
    assert.equal(evaluateIpn(base).decision, "APPLY_SUCCESS");
    assert.equal(
      evaluateIpn({ ...base, paymentSuccessful: false }).decision,
      "RECORD_FAILURE",
    );
    assert.equal(
      evaluateIpn({ ...base, params: { vnp_Amount: "1" } }).decision,
      "AMOUNT_MISMATCH",
    );
    assert.equal(
      evaluateIpn({
        ...base,
        order: order({ expiresAt: new Date(NOW.getTime() - 1) }),
      }).decision,
      "LATE_PAYMENT",
    );
    assert.equal(
      evaluateIpn({
        ...base,
        paymentSuccessful: false,
        order: order({ expiresAt: new Date(NOW.getTime() - 1) }),
      }).decision,
      "MANUAL_REVIEW",
    );
    assert.equal(
      evaluateIpn({
        ...base,
        transaction: { status: TransactionStatus.SUCCESS, amount: "150000.00" },
        order: order({ status: OrderStatus.PAID }),
      }).decision,
      "ALREADY_PROCESSED",
    );
  });

  it("treats a repeated failed callback as already processed", () => {
    const result = evaluateIpn({
      params: { vnp_Amount: "15000000" },
      paymentSuccessful: false,
      transaction: { status: TransactionStatus.FAILED, amount: "150000.00" },
      order: order({ status: OrderStatus.FAILED }),
      now: NOW,
    });
    assert.equal(result.decision, "ALREADY_PROCESSED");
  });

  it("validates settlement items", () => {
    const seat = (id: string | null, q = 1) => ({
      seatId: id,
      ticketTypeId: "t",
      quantity: q,
    });
    assert.equal(areSettlementItemsValid([]), false);
    assert.equal(areSettlementItemsValid([seat("a"), seat(null, 3)]), true);
    assert.equal(areSettlementItemsValid([seat("a"), seat("a")]), false);
    assert.equal(areSettlementItemsValid([seat("a", 2)]), false);
    assert.equal(areSettlementItemsValid([seat(null, 0)]), false);
  });

  it("keeps only reconciliation fields in the stored evidence", () => {
    const evidence = buildCallbackEvidence({
      vnp_TxnRef: "R",
      vnp_Amount: "1",
      vnp_SecureHash: "secret",
      vnp_TmnCode: "code",
    });
    assert.equal(evidence.vnp_TxnRef, "R");
    assert.equal("vnp_SecureHash" in evidence, false);
    assert.equal(evidence.vnp_BankCode, null);
  });
});
