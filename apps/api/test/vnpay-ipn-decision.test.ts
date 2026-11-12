import assert from "node:assert/strict";
import { test } from "node:test";
import { OrderStatus, TransactionStatus } from "@tickethub/shared";
import {
  decideVnpayIpn,
  type IpnDecisionInput,
} from "../src/contexts/payment/domain/ipn-decision";

const valid: IpnDecisionInput = {
  signatureValid: true,
  transactionFound: true,
  amountMatches: true,
  orderStatus: OrderStatus.PENDING,
  transactionStatus: TransactionStatus.PENDING,
  paymentSuccessful: true,
  orderExpired: false,
};

test("Reject invalid signature", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      signatureValid: false,
    }),
    "INVALID_SIGNATURE",
  );
});

test("Reject unknown transaction", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      transactionFound: false,
    }),
    "ORDER_NOT_FOUND",
  );
});

test("Reject mismatched amount", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      amountMatches: false,
    }),
    "AMOUNT_MISMATCH",
  );
});

test("Accept valid pending payment for settlement", () => {
  assert.equal(decideVnpayIpn(valid), "APPLY_SUCCESS");
});

test("Do not process duplicate completed payment", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      orderStatus: OrderStatus.PAID,
      transactionStatus: TransactionStatus.SUCCESS,
    }),
    "ALREADY_PROCESSED",
  );
});

test("A successful payment on a lapsed order is a late payment, never lost", () => {
  for (const lapsed of [
    { orderExpired: true },
    { orderStatus: OrderStatus.EXPIRED },
    { orderStatus: OrderStatus.CANCELLED },
  ]) {
    assert.equal(decideVnpayIpn({ ...valid, ...lapsed }), "LATE_PAYMENT");
  }
});

test("A failed payment on a lapsed order only needs review", () => {
  assert.equal(
    decideVnpayIpn({ ...valid, orderExpired: true, paymentSuccessful: false }),
    "MANUAL_REVIEW",
  );
});

test("A settled late payment is not processed twice", () => {
  for (const orderStatus of [
    OrderStatus.PAYMENT_EXPIRED_REFUND_PENDING,
    OrderStatus.REFUNDED,
    OrderStatus.PAID,
  ]) {
    assert.equal(
      decideVnpayIpn({
        ...valid,
        orderStatus,
        transactionStatus: TransactionStatus.SUCCESS,
      }),
      "ALREADY_PROCESSED",
    );
  }
});

test("Review inconsistent order and transaction states", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      orderStatus: OrderStatus.PAID,
      transactionStatus: TransactionStatus.PENDING,
    }),
    "MANUAL_REVIEW",
  );
});

test("Review conflicting failed transaction", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      transactionStatus: TransactionStatus.FAILED,
    }),
    "MANUAL_REVIEW",
  );
});

test("Record legitimate failed payment separately", () => {
  assert.equal(
    decideVnpayIpn({
      ...valid,
      paymentSuccessful: false,
    }),
    "RECORD_FAILURE",
  );
});
