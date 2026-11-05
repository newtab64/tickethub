import { test } from "node:test";
import assert from "node:assert/strict";
import { CheckoutOrderSchema } from "@tickethub/shared";
import {
  remainingSeconds,
  paymentState,
  safePaymentUrl,
} from "../src/lib/checkout.ts";

test("Countdown uses deadline and catches elapsed time after suspended tab", () => {
  assert.equal(remainingSeconds(300_000, 0), 300);
  assert.equal(remainingSeconds(300_000, 245_500), 55);
  assert.equal(remainingSeconds(300_000, 400_000), 0);
});
test("Only backend PAID confirms success; PENDING is never successful", () => {
  assert.equal(paymentState("PENDING"), "processing");
  assert.equal(paymentState("PAID"), "success");
  for (const status of ["CANCELLED", "EXPIRED", "FAILED"] as const)
    assert.equal(paymentState(status), "failed");
  assert.equal(paymentState("REFUNDED"), "refunded");
});
test("Payment redirects reject other origins, plaintext, credentials and ports", () => {
  assert.equal(
    new URL(
      safePaymentUrl(
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=100",
      ),
    ).hostname,
    "sandbox.vnpayment.vn",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://sandbox.vnpayment.vn/",
    "https://sandbox.vnpayment.vn.evil.example/",
    "https://user@sandbox.vnpayment.vn/",
    "https://pay.vnpay.vn:444/",
  ])
    assert.throws(() => safePaymentUrl(url));
});
test("Checkout never accepts fabricated or incomplete fallback orders", () => {
  assert.equal(
    CheckoutOrderSchema.safeParse({
      orderId: "ord-sample-01",
      totalAmount: 5_000_000,
    }).success,
    false,
  );
  assert.equal(CheckoutOrderSchema.safeParse({}).success, false);
});
