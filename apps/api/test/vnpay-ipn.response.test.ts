import test from "node:test";
import assert from "node:assert/strict";

import { toVnpayResponse } from "../src/contexts/payment/interface/vnpay-ipn.controller";
import type { IpnDecision } from "../src/contexts/payment/domain/ipn-decision";

const cases: Array<[IpnDecision, string]> = [
  ["APPLY_SUCCESS", "00"],
  ["RECORD_FAILURE", "00"],
  ["LATE_RESTORED", "00"],
  ["LATE_REFUND_PENDING", "00"],
  ["ALREADY_PROCESSED", "02"],
  ["ORDER_NOT_FOUND", "01"],
  ["AMOUNT_MISMATCH", "04"],
  ["INVALID_SIGNATURE", "97"],
  ["MANUAL_REVIEW", "99"],
];

for (const [decision, expectedCode] of cases) {
  test(`IPN response: ${decision}`, () => {
    const result = toVnpayResponse(decision);
    assert.equal(result.RspCode, expectedCode);
    assert.equal(typeof result.Message, "string");
  });
}
