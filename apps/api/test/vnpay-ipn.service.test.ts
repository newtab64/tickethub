import test from "node:test";
import assert from "node:assert/strict";

import { createPaymentUseCases } from "../src/contexts/payment/payment.composition";

test("IPN: Reject callback without signature", async () => {
  const service = createPaymentUseCases().processIpn;

  const result = await service.process({
    vnp_TxnRef: "TEST001",
    vnp_Amount: "60000000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
  });

  assert.equal(result, "INVALID_SIGNATURE");
});

test("IPN: Reject malformed signature", async () => {
  const service = createPaymentUseCases().processIpn;

  const result = await service.process({
    vnp_TxnRef: "TEST002",
    vnp_Amount: "60000000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_SecureHash: "invalid-signature",
  });

  assert.equal(result, "INVALID_SIGNATURE");
});

test("IPN: Reject incorrect signature", async () => {
  const service = createPaymentUseCases().processIpn;

  const result = await service.process({
    vnp_TxnRef: "TEST003",
    vnp_Amount: "60000000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_SecureHash: "0".repeat(128),
  });

  assert.equal(result, "INVALID_SIGNATURE");
});
