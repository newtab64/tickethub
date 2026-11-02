import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { env } from "../src/config/env.config";
import { VnpayGateway } from "../src/payments/vnpay.gateway";

const gateway = new VnpayGateway();

const input = {
  requestId: "a".repeat(32),
  transactionRef: "REFUNDTEST01",
  transactionDate: "20261030100000",
  createDate: "20261030220000",
  originalAmountMinor: "60000000",
  refundAmountMinor: "42000000",
  createBy: "tickethub-system",
  ipAddress: "127.0.0.1",
  orderInfo: "Refund TicketHub order",
};

test("W04 Refund: partial refund uses type 03", () => {
  const payload = gateway.buildRefundRequest(input);

  assert.equal(payload.vnp_Command, "refund");
  assert.equal(payload.vnp_TransactionType, "03");

  assert.equal(payload.vnp_Amount, "42000000");
  assert.equal(payload.vnp_TxnRef, "REFUNDTEST01");

  const fields = [
    "vnp_RequestId",
    "vnp_Version",
    "vnp_Command",
    "vnp_TmnCode",
    "vnp_TransactionType",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_TransactionNo",
    "vnp_TransactionDate",
    "vnp_CreateBy",
    "vnp_CreateDate",
    "vnp_IpAddr",
    "vnp_OrderInfo",
  ];

  const expected = createHmac("sha512", env.VNPAY_HASH_SECRET)
    .update(fields.map((key) => payload[key]).join("|"), "utf8")
    .digest("hex");

  assert.equal(payload.vnp_SecureHash, expected);
});

test("W04 Refund: full refund uses type 02", () => {
  const payload = gateway.buildRefundRequest({
    ...input,
    refundAmountMinor: "60000000",
  });

  assert.equal(payload.vnp_TransactionType, "02");
});

test("W04 Refund: cannot exceed original payment", () => {
  assert.throws(() =>
    gateway.buildRefundRequest({
      ...input,
      refundAmountMinor: "70000000",
    }),
  );
});
