import assert from "node:assert/strict";
import { test } from "node:test";
import { toVnpayAmount } from "../src/payments/vnpay-ipn.preview.service";
import { parseVndAmount } from "../src/payments/vnpay-amount";
test("Convert 10000 VND to VNPay amount", () => {
  assert.equal(toVnpayAmount("10000.00"), "1000000");
});

test("Reject fractional VND", () => {
  assert.equal(toVnpayAmount("10000.50"), null);
});

test("Reject invalid or negative amount", () => {
  assert.equal(toVnpayAmount("-10000"), null);
  assert.equal(toVnpayAmount("abc"), null);
  assert.equal(parseVndAmount(null), null);
  assert.equal(parseVndAmount(undefined), null);
  assert.equal(parseVndAmount(150000), null);
  assert.equal(parseVndAmount({}), null);
});

test("Reject zero payment amount", () => {
  assert.equal(toVnpayAmount("0.00"), null);
});

test("Shared VND validation is consistent", () => {
  assert.equal(parseVndAmount("150000.00"), 150000);
  assert.equal(parseVndAmount("150000"), 150000);

  assert.equal(toVnpayAmount("150000.00"), "15000000");
  assert.equal(toVnpayAmount("150000"), "15000000");

  assert.equal(parseVndAmount("150000.50"), null);
  assert.equal(toVnpayAmount("150000.50"), null);

  assert.equal(parseVndAmount("0.00"), null);
  assert.equal(parseVndAmount("-100"), null);
  assert.equal(parseVndAmount("abc"), null);

  assert.equal(parseVndAmount("9999999999.00"), 9999999999);

  assert.equal(parseVndAmount("10000000000.00"), null);
});
